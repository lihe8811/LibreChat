jest.mock('~/cache/getLogStores');

const mockGetAppConfig = jest.fn();
jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: (...args) => mockGetAppConfig(...args),
}));

jest.mock('~/server/services/Config/ldap', () => ({
  getLdapConfig: jest.fn(() => null),
}));

const mockHasCapability = jest.fn();
jest.mock('~/server/middleware/roles/capabilities', () => ({
  hasCapability: (...args) => mockHasCapability(...args),
}));

const mockGetTenantId = jest.fn(() => undefined);
jest.mock('@librechat/data-schemas', () => ({
  ...jest.requireActual('@librechat/data-schemas'),
  getTenantId: (...args) => mockGetTenantId(...args),
}));

const mockGetCloudFrontConfig = jest.fn(() => null);
const mockResolveBuildInfo = jest.fn(() => ({
  commit: null,
  commitShort: null,
  branch: null,
  buildDate: null,
}));
jest.mock('@librechat/api', () => ({
  ...jest.requireActual('@librechat/api'),
  getCloudFrontConfig: (...args) => mockGetCloudFrontConfig(...args),
  resolveBuildInfo: (...args) => mockResolveBuildInfo(...args),
}));

const request = require('supertest');
const express = require('express');
const configRoute = require('../config');

function createApp(user) {
  const app = express();
  app.disable('x-powered-by');
  if (user) {
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
  }
  app.use('/api/config', configRoute);
  return app;
}

const brandingConfig = {
  logoVariant: 'qingfan',
  appTitle: {
    default: 'Default Title',
    qingfan: 'Qingfan Title',
  },
  helpAndFaqURL: {
    default: 'https://example.com/help',
    qingfan: 'https://example.com/qingfan-help',
  },
};

const baseAppConfig = {
  registration: { socialLogins: ['google', 'github'] },
  interfaceConfig: {
    privacyPolicy: { externalUrl: 'https://example.com/privacy' },
    termsOfService: { externalUrl: 'https://example.com/tos' },
    modelSelect: true,
  },
  turnstileConfig: { siteKey: 'test-key' },
  modelSpecs: { list: [{ name: 'test-spec' }] },
  webSearch: { searchProvider: 'tavily' },
  branding: brandingConfig,
};

const mockUser = {
  id: 'user123',
  role: 'USER',
  tenantId: undefined,
};

afterEach(() => {
  jest.resetAllMocks();
  mockResolveBuildInfo.mockReturnValue({
    commit: null,
    commitShort: null,
    branch: null,
    buildDate: null,
  });
  delete process.env.ALLOW_ACCOUNT_DELETION;
  delete process.env.ALLOW_PASSWORD_RESET;
  delete process.env.ALLOW_REGISTRATION;
  delete process.env.ALLOW_SOCIAL_LOGIN;
  delete process.env.APP_TITLE;
  delete process.env.CHECK_BALANCE;
  delete process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES;
  delete process.env.DISCORD_CLIENT_ID;
  delete process.env.DISCORD_CLIENT_SECRET;
  delete process.env.DOMAIN_SERVER;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.HELP_AND_FAQ_URL;
  delete process.env.OPENID_CLIENT_ID;
  delete process.env.OPENID_CLIENT_SECRET;
  delete process.env.OPENID_ISSUER;
  delete process.env.OPENID_SESSION_SECRET;
  delete process.env.SAML_CERT;
  delete process.env.SAML_ENTRY_POINT;
  delete process.env.SAML_ISSUER;
  delete process.env.SAML_SESSION_SECRET;
  delete process.env.SANDPACK_BUNDLER_URL;
  delete process.env.SANDPACK_STATIC_BUNDLER_URL;
  delete process.env.START_BALANCE;
  delete process.env.ANALYTICS_GTM_ID;
  delete process.env.CUSTOM_FOOTER;
});

describe('GET /api/config', () => {
  describe('unauthenticated (no req.user)', () => {
    it('calls getAppConfig with baseOnly when no tenant context', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetTenantId.mockReturnValue(undefined);
      const app = createApp(null);

      await request(app).get('/api/config');

      expect(mockGetAppConfig).toHaveBeenCalledWith({ baseOnly: true });
    });

    it('calls getAppConfig with tenantId when tenant context is present', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetTenantId.mockReturnValue('tenant-abc');
      const app = createApp(null);

      await request(app).get('/api/config');

      expect(mockGetAppConfig).toHaveBeenCalledWith({ tenantId: 'tenant-abc' });
    });

    it('maps tenant-scoped config fields in the unauthenticated response', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        registration: { socialLogins: ['saml'] },
        turnstileConfig: { siteKey: 'tenant-key' },
      });
      mockGetTenantId.mockReturnValue('tenant-abc');
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.statusCode).toBe(200);
      expect(response.body.socialLogins).toEqual(['saml']);
      expect(response.body.turnstile).toEqual({ siteKey: 'tenant-key' });
      expect(response.body).not.toHaveProperty('modelSpecs');
    });

    it('returns a minimal payload without authenticated-only fields', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toHaveProperty('balance');
      expect(response.body).not.toHaveProperty('bundlerURL');
      expect(response.body).not.toHaveProperty('staticBundlerURL');
      expect(response.body).not.toHaveProperty('sharePointFilePickerEnabled');
      expect(response.body).not.toHaveProperty('sharePointBaseUrl');
      expect(response.body).not.toHaveProperty('sharePointPickerGraphScope');
      expect(response.body).not.toHaveProperty('sharePointPickerSharePointScope');
      expect(response.body).not.toHaveProperty('conversationImportMaxFileSize');
      expect(response.body).not.toHaveProperty('modelSpecs');
      expect(response.body).not.toHaveProperty('webSearch');
    });

    it('should strip authenticated-only informational fields from unauthenticated response (#12688)', async () => {
      process.env.ANALYTICS_GTM_ID = 'GTM-XYZ';
      process.env.CUSTOM_FOOTER = 'internal footer text';
      process.env.HELP_AND_FAQ_URL = 'https://internal.example.com/faq';
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.statusCode).toBe(200);
      expect(response.body).not.toHaveProperty('showBirthdayIcon');
      expect(response.body).not.toHaveProperty('helpAndFaqURL');
      expect(response.body).not.toHaveProperty('sharedLinksEnabled');
      expect(response.body).not.toHaveProperty('publicSharedLinksEnabled');
      expect(response.body).not.toHaveProperty('analyticsGtmId');
      expect(response.body).not.toHaveProperty('openidReuseTokens');
      expect(response.body).not.toHaveProperty('allowAccountDeletion');
      expect(response.body).not.toHaveProperty('customFooter');
    });

    it('should include public share footer fields when share context is requested', async () => {
      process.env.ANALYTICS_GTM_ID = 'GTM-XYZ';
      process.env.CUSTOM_FOOTER = 'public footer text';
      process.env.HELP_AND_FAQ_URL = 'https://internal.example.com/faq';
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config?context=share');

      expect(response.statusCode).toBe(200);
      expect(response.body.analyticsGtmId).toBe('GTM-XYZ');
      expect(response.body.customFooter).toBe('public footer text');
      expect(response.body).not.toHaveProperty('helpAndFaqURL');
      expect(response.body).not.toHaveProperty('allowAccountDeletion');
    });

    it('should include socialLogins and turnstile from base config', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.socialLogins).toEqual(['google', 'github']);
      expect(response.body.turnstile).toEqual({ siteKey: 'test-key' });
    });

    it('should include only privacyPolicy and termsOfService from interface config', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.interface).toEqual({
        privacyPolicy: { externalUrl: 'https://example.com/privacy' },
        termsOfService: { externalUrl: 'https://example.com/tos' },
      });
      expect(response.body.interface).not.toHaveProperty('modelSelect');
    });

    it('preserves branding overrides for unauthenticated requests', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.appTitle).toBe('Qingfan Title');
      expect(response.body).not.toHaveProperty('helpAndFaqURL');
      expect(response.body.branding).toEqual(
        expect.objectContaining({
          appTitle: 'Qingfan Title',
          assetPrefix: 'assets/qingfan',
          logoVariant: 'qingfan',
        }),
      );
      expect(response.body.branding).not.toHaveProperty('helpAndFaqURL');
    });

    it('should omit CloudFront cookie refresh from unauthenticated response (#12688)', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetCloudFrontConfig.mockReturnValue({
        domain: 'https://cdn.example.com',
        imageSigning: 'cookies',
        cookieDomain: '.example.com',
        privateKey: 'test-private-key',
        keyPairId: 'K123ABC',
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('cloudFront');
    });

    it('should omit CloudFront cookie refresh when cookie mode cannot mint cookies', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetCloudFrontConfig.mockReturnValue({
        domain: 'https://cdn.example.com',
        imageSigning: 'cookies',
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('cloudFront');
    });

    it('defaults allowAccountDeletion to true when env var is unset', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('cloudFront');
    });

    it('omits buildInfo in unauthenticated response when interface.buildInfo is false', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { ...baseAppConfig.interfaceConfig, buildInfo: false },
      });
      mockResolveBuildInfo.mockReturnValue({
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
        commitShort: 'abcdef1',
        branch: 'dev',
        buildDate: '2026-04-20T12:00:00Z',
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('buildInfo');
      expect(response.body.interface).toEqual({
        privacyPolicy: { externalUrl: 'https://example.com/privacy' },
        termsOfService: { externalUrl: 'https://example.com/tos' },
        buildInfo: false,
      });
    });

    it('includes buildInfo in unauthenticated response when enabled', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockResolveBuildInfo.mockReturnValue({
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
        commitShort: 'abcdef1',
        branch: 'dev',
        buildDate: '2026-04-20T12:00:00Z',
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.buildInfo).toEqual({
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
        commitShort: 'abcdef1',
        branch: 'dev',
        buildDate: '2026-04-20T12:00:00Z',
      });
    });

    it('should return 500 when getAppConfig throws', async () => {
      mockGetAppConfig.mockRejectedValue(new Error('Config service failure'));
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('authenticated (req.user exists)', () => {
    it('calls getAppConfig with role, userId, and tenantId', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetTenantId.mockReturnValue('fallback-tenant');
      const app = createApp(mockUser);

      await request(app).get('/api/config');

      expect(mockGetAppConfig).toHaveBeenCalledWith({
        role: 'USER',
        userId: 'user123',
        tenantId: 'fallback-tenant',
      });
    });

    it('prefers user tenantId over getTenantId fallback', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetTenantId.mockReturnValue('fallback-tenant');
      const app = createApp({ ...mockUser, tenantId: 'user-tenant' });

      await request(app).get('/api/config');

      expect(mockGetAppConfig).toHaveBeenCalledWith({
        role: 'USER',
        userId: 'user123',
        tenantId: 'user-tenant',
      });
    });

    it('includes modelSpecs, balance, and webSearch', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      process.env.CHECK_BALANCE = 'true';
      process.env.START_BALANCE = '10000';
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.modelSpecs).toEqual({ list: [{ name: 'test-spec' }] });
      expect(response.body.balance).toEqual({ enabled: true, startBalance: 10000 });
      expect(response.body.webSearch).toEqual({ searchProvider: 'tavily' });
    });

    it('should strip private prompt fields from model spec presets', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        modelSpecs: {
          enforce: false,
          prioritize: true,
          list: [
            {
              name: 'guarded-spec',
              label: 'Guarded Spec',
              skills: ['private-skill'],
              preset: {
                endpoint: 'openAI',
                model: 'gpt-4o',
                promptPrefix: 'private prompt prefix',
                instructions: 'private assistant instructions',
                additional_instructions: 'private additional instructions',
                system: 'private bedrock system',
                context: 'private context',
                examples: [{ input: { content: 'a' }, output: { content: 'b' } }],
                greeting: 'Hello',
              },
            },
          ],
        },
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.statusCode).toBe(200);
      expect(response.body.modelSpecs.list[0].preset).toEqual({
        endpoint: 'openAI',
        model: 'gpt-4o',
        greeting: 'Hello',
      });
      expect(response.body.modelSpecs.list[0]).not.toHaveProperty('skills');
    });

    it('should include full interface config', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.interface).toEqual(baseAppConfig.interfaceConfig);
    });

    it('includes branding and authenticated-only env var fields', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      process.env.SANDPACK_BUNDLER_URL = 'https://bundler.test';
      process.env.SANDPACK_STATIC_BUNDLER_URL = 'https://static-bundler.test';
      process.env.CONVERSATION_IMPORT_MAX_FILE_SIZE_BYTES = '5000000';
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.appTitle).toBe('Qingfan Title');
      expect(response.body.branding).toEqual(
        expect.objectContaining({
          assetPrefix: 'assets/qingfan',
          logoVariant: 'qingfan',
        }),
      );
      expect(response.body.bundlerURL).toBe('https://bundler.test');
      expect(response.body.staticBundlerURL).toBe('https://static-bundler.test');
      expect(response.body.conversationImportMaxFileSize).toBe(5000000);
    });

    it('should include post-login informational fields', async () => {
      process.env.ANALYTICS_GTM_ID = 'GTM-XYZ';
      process.env.CUSTOM_FOOTER = 'authenticated footer text';
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).toHaveProperty('helpAndFaqURL');
      expect(response.body).toHaveProperty('sharedLinksEnabled');
      expect(response.body).toHaveProperty('publicSharedLinksEnabled');
      expect(response.body).toHaveProperty('showBirthdayIcon');
      expect(response.body).toHaveProperty('openidReuseTokens');
      expect(response.body.helpAndFaqURL).toBe('https://example.com/qingfan-help');
      expect(response.body.analyticsGtmId).toBe('GTM-XYZ');
      expect(response.body.customFooter).toBe('authenticated footer text');
    });

    it('should advertise CloudFront cookie refresh when signed-cookie mode is active', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetCloudFrontConfig.mockReturnValue({
        domain: 'https://cdn.example.com',
        imageSigning: 'cookies',
        cookieDomain: '.example.com',
        privateKey: 'test-private-key',
        keyPairId: 'K123ABC',
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.cloudFront).toEqual({
        cookieRefresh: {
          endpoint: '/api/auth/cloudfront/refresh',
          domain: 'https://cdn.example.com',
        },
      });
    });

    it('should omit CloudFront cookie refresh when signed-cookie mode is inactive', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetCloudFrontConfig.mockReturnValue({
        domain: 'https://cdn.example.com',
        imageSigning: 'url',
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('cloudFront');
    });

    it('should omit CloudFront cookie refresh when cookie mode cannot mint cookies', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockGetCloudFrontConfig.mockReturnValue({
        domain: 'https://cdn.example.com',
        imageSigning: 'cookies',
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('cloudFront');
    });

    it('should merge per-user balance override into config', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        balance: {
          enabled: true,
          startBalance: 50000,
        },
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.balance).toEqual(
        expect.objectContaining({
          enabled: true,
          startBalance: 50000,
        }),
      );
    });

    it('should set allowAccountDeletion to false for authenticated users without ACCESS_ADMIN', async () => {
      process.env.ALLOW_ACCOUNT_DELETION = 'false';
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockHasCapability.mockResolvedValue(false);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.allowAccountDeletion).toBe(false);
      expect(mockHasCapability).toHaveBeenCalled();
    });

    it('overrides allowAccountDeletion to true for users with ACCESS_ADMIN', async () => {
      process.env.ALLOW_ACCOUNT_DELETION = 'false';
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockHasCapability.mockResolvedValue(true);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.allowAccountDeletion).toBe(true);
      expect(mockHasCapability).toHaveBeenCalled();
    });

    it('does not call hasCapability when allowAccountDeletion is already true', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.allowAccountDeletion).toBe(true);
      expect(mockHasCapability).not.toHaveBeenCalled();
    });

    it('omits buildInfo in authenticated response when interface.buildInfo is false', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { ...baseAppConfig.interfaceConfig, buildInfo: false },
      });
      mockResolveBuildInfo.mockReturnValue({
        commit: 'abcdef1234567890abcdef1234567890abcdef12',
        commitShort: 'abcdef1',
        branch: 'dev',
        buildDate: '2026-04-20T12:00:00Z',
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('buildInfo');
    });
  });

  describe('buildInfo payload', () => {
    const populatedBuildInfo = {
      commit: 'abcdef1234567890abcdef1234567890abcdef12',
      commitShort: 'abcdef1',
      branch: 'dev',
      buildDate: '2026-04-20T12:00:00Z',
    };

    it('includes buildInfo in authenticated response when interface flag is not explicitly disabled', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockResolveBuildInfo.mockReturnValue(populatedBuildInfo);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body.buildInfo).toEqual(populatedBuildInfo);
    });

    it('omits buildInfo when interface.buildInfo is false', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { ...baseAppConfig.interfaceConfig, buildInfo: false },
      });
      mockResolveBuildInfo.mockReturnValue(populatedBuildInfo);
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('buildInfo');
    });

    it('omits buildInfo when all resolver fields are null', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockResolveBuildInfo.mockReturnValue({
        commit: null,
        commitShort: null,
        branch: null,
        buildDate: null,
      });
      const app = createApp(mockUser);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('buildInfo');
    });

    it('includes buildInfo in unauthenticated response when flag is not disabled', async () => {
      mockGetAppConfig.mockResolvedValue(baseAppConfig);
      mockResolveBuildInfo.mockReturnValue(populatedBuildInfo);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.buildInfo).toEqual(populatedBuildInfo);
    });

    it('omits buildInfo in unauthenticated response when interface.buildInfo is false', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { ...baseAppConfig.interfaceConfig, buildInfo: false },
      });
      mockResolveBuildInfo.mockReturnValue(populatedBuildInfo);
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body).not.toHaveProperty('buildInfo');
    });

    it('propagates interface.buildInfo=false in unauthenticated response so clients can hide About tab', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { ...baseAppConfig.interfaceConfig, buildInfo: false },
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.interface).toBeDefined();
      expect(response.body.interface.buildInfo).toBe(false);
    });

    it('does not add interface.buildInfo=true to unauthenticated response (default stays implicit)', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { privacyPolicy: { externalUrl: 'https://x' }, buildInfo: true },
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.interface).toBeDefined();
      expect(response.body.interface).not.toHaveProperty('buildInfo');
    });

    it('includes interface block with only buildInfo=false when nothing else is set', async () => {
      mockGetAppConfig.mockResolvedValue({
        ...baseAppConfig,
        interfaceConfig: { buildInfo: false },
      });
      const app = createApp(null);

      const response = await request(app).get('/api/config');

      expect(response.body.interface).toEqual({ buildInfo: false });
    });
  });
});
