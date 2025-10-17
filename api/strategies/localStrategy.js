const { logger } = require('@librechat/data-schemas');
const { errorsToString } = require('librechat-data-provider');
const { isEnabled, checkEmailConfig } = require('@librechat/api');
const { Strategy: PassportLocalStrategy } = require('passport-local');
const { findUser, comparePassword, updateUser } = require('~/models');
const { loginSchema } = require('./validators');

// Unix timestamp for 2024-06-07 15:20:18 Eastern Time
const verificationEnabledTimestamp = 1717788018;
const emailLoginEnabled =
  process.env.ALLOW_EMAIL_LOGIN === undefined || isEnabled(process.env.ALLOW_EMAIL_LOGIN);
const loginField = emailLoginEnabled ? 'email' : 'username';

async function validateLoginRequest(req) {
  const { error } = loginSchema.safeParse(req.body);
  return error ? errorsToString(error.errors) : null;
}

async function passportLogin(req, identifier, password, done) {
  try {
    const validationError = await validateLoginRequest(req);
    if (validationError) {
      logError('Passport Local Strategy - Validation Error', { reqBody: req.body });
      logger.error(`[Login] [Login failed] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: validationError });
    }

    const normalizedIdentifier =
      typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
    const user = await findUser({ [loginField]: normalizedIdentifier }, '+password');
    if (!user) {
      logError('Passport Local Strategy - User Not Found', { [loginField]: identifier });
      logger.error(`[Login] [Login failed] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
      const notFoundMessage = emailLoginEnabled ? 'Email does not exist.' : 'Username does not exist.';
      return done(null, false, { message: notFoundMessage });
    }

    if (!user.password) {
      logError('Passport Local Strategy - User has no password', { [loginField]: identifier });
      logger.error(`[Login] [Login failed] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
      const notFoundMessage = emailLoginEnabled ? 'Email does not exist.' : 'Username does not exist.';
      return done(null, false, { message: notFoundMessage });
    }

    const isMatch = await comparePassword(user, password);
    if (!isMatch) {
      logError('Passport Local Strategy - Password does not match', { isMatch });
      logger.error(`[Login] [Login failed] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
      return done(null, false, { message: 'Incorrect password.' });
    }

    const emailEnabled = checkEmailConfig();
    const userCreatedAtTimestamp = Math.floor(new Date(user.createdAt).getTime() / 1000);

    if (
      !emailEnabled &&
      !user.emailVerified &&
      userCreatedAtTimestamp < verificationEnabledTimestamp
    ) {
      await updateUser(user._id, { emailVerified: true });
      user.emailVerified = true;
    }

    const unverifiedAllowed = isEnabled(process.env.ALLOW_UNVERIFIED_EMAIL_LOGIN);
    if (user.expiresAt && unverifiedAllowed) {
      await updateUser(user._id, {});
    }

    if (!user.emailVerified && !unverifiedAllowed) {
      logError('Passport Local Strategy - Email not verified', { email: user.email });
      logger.error(`[Login] [Login failed] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
      return done(null, user, { message: 'Email not verified.' });
    }

    logger.info(`[Login] [Login successful] [Identifier: ${identifier}] [Request-IP: ${req.ip}]`);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}

function logError(title, parameters) {
  const entries = Object.entries(parameters).map(([name, value]) => ({ name, value }));
  logger.error(title, { parameters: entries });
}

module.exports = () =>
  new PassportLocalStrategy(
    {
      usernameField: loginField,
      passwordField: 'password',
      session: false,
      passReqToCallback: true,
    },
    passportLogin,
  );
