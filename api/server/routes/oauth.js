// file deepcode ignore NoRateLimitingForLogin: Rate limiting is handled by the `loginLimiter` middleware
const express = require('express');
const passport = require('passport');
// Import randomState dynamically later
// const { randomState } = require('openid-client');
const {
  checkBan,
  logHeaders,
  loginLimiter,
  setBalanceConfig,
  checkDomainAllowed,
} = require('~/server/middleware');
const { setAuthTokens, setOpenIDAuthTokens } = require('~/server/services/AuthService');
const { isEnabled } = require('~/server/utils');
const { logger } = require('~/config');

const router = express.Router();

const domains = {
  client: process.env.DOMAIN_CLIENT,
  server: process.env.DOMAIN_SERVER,
};

// Initialize variable to store randomState function after dynamic import
let randomState;

// Dynamically import openid-client
(async () => {
  try {
    const openidClient = await import('openid-client');
    randomState = openidClient.randomState;
    logger.info('Successfully imported openid-client');
  } catch (err) {
    logger.error('Error importing openid-client:', err);
  }
})();

router.use(logHeaders);
router.use(loginLimiter);

const oauthHandler = async (req, res) => {
  try {
    await checkDomainAllowed(req, res);
    await checkBan(req, res);
    if (req.banned) {
      return;
    }
    if (
      req.user &&
      req.user.provider == 'openid' &&
      isEnabled(process.env.OPENID_REUSE_TOKENS) === true
    ) {
      setOpenIDAuthTokens(req.user.tokenset, res);
    } else {
      await setAuthTokens(req.user._id, res);
    }
    res.redirect(domains.client);
  } catch (err) {
    logger.error('Error in setting authentication tokens:', err);
  }
};

router.get('/error', (req, res) => {
  // A single error message is pushed by passport when authentication fails.
  logger.error('Error in OAuth authentication:', {
    message: req.session?.messages?.pop() || 'Unknown error',
  });

  // Redirect to login page with auth_failed parameter to prevent infinite redirect loops
  res.redirect(`${domains.client}/login?redirect=false`);
});

/**
 * Google Routes
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['openid', 'profile', 'email'],
    session: false,
  }),
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['openid', 'profile', 'email'],
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * Facebook Routes
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['public_profile'],
    profileFields: ['id', 'email', 'name'],
    session: false,
  }),
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['public_profile'],
    profileFields: ['id', 'email', 'name'],
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * OpenID Routes
 */
router.get('/openid', async (req, res, next) => {
  try {
    // If randomState is not yet initialized, import it now
    if (!randomState) {
      const openidClient = await import('openid-client');
      randomState = openidClient.randomState;
    }
    
    return passport.authenticate('openid', {
      session: false,
      state: randomState(),
    })(req, res, next);
  } catch (err) {
    logger.error('Error in OpenID authentication:', err);
    res.redirect(`${domains.client}/oauth/error`);
  }
});

router.get(
  '/openid/callback',
  passport.authenticate('openid', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * GitHub Routes
 */
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email', 'read:user'],
    session: false,
  }),
);

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['user:email', 'read:user'],
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * Discord Routes
 */
router.get(
  '/discord',
  passport.authenticate('discord', {
    scope: ['identify', 'email'],
    session: false,
  }),
);

router.get(
  '/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
    scope: ['identify', 'email'],
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * Apple Routes
 */
router.get(
  '/apple',
  passport.authenticate('apple', {
    session: false,
  }),
);

router.post(
  '/apple/callback',
  passport.authenticate('apple', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  setBalanceConfig,
  oauthHandler,
);

/**
 * SAML Routes
 */
router.get(
  '/saml',
  passport.authenticate('saml', {
    session: false,
  }),
);

router.post(
  '/saml/callback',
  passport.authenticate('saml', {
    failureRedirect: `${domains.client}/oauth/error`,
    failureMessage: true,
    session: false,
  }),
  oauthHandler,
);

module.exports = router;
