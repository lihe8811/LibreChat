const express = require('express');
const request = require('supertest');

jest.mock(
  '@librechat/api',
  () => ({
    isEnabled: jest.fn(() => false),
    getBalanceConfig: jest.fn(() => ({})),
  }),
  { virtual: true },
);

jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock('~/server/services/Config/ldap', () => ({
  getLdapConfig: jest.fn(() => null),
}));

jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: jest.fn(async () => ({
    registration: {},
    interfaceConfig: {},
    turnstileConfig: {},
    modelSpecs: {},
    branding: {},
  })),
}));

jest.mock('~/models/Project', () => ({
  getProjectByName: jest.fn(async () => ({ _id: 'test-project-id' })),
}));

jest.mock('~/cache', () => ({
  getLogStores: jest.fn(() => ({
    get: jest.fn(async () => null),
    set: jest.fn(async () => null),
  })),
}));

jest.mock(
  'librechat-data-provider',
  () => ({
    Constants: {
      GLOBAL_PROJECT_NAME: 'GLOBAL',
    },
    CacheKeys: {
      CONFIG_STORE: 'CONFIG_STORE',
      STARTUP_CONFIG: 'STARTUP_CONFIG',
    },
    defaultSocialLogins: {},
    removeNullishValues: jest.fn((value) => value),
  }),
  { virtual: true },
);

describe('Config Routes', () => {
  let app;

  beforeAll(() => {
    const configRouter = require('../config');

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { role: 'user' };
      next();
    });
    app.use('/api/config', configRouter);
  });

  it('should return startup config successfully', async () => {
    const response = await request(app).get('/api/config');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('branding');
  });
});
