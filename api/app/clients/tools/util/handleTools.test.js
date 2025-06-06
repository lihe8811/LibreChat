const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const mockPluginService = {
  updateUserPluginAuth: jest.fn(),
  deleteUserPluginAuth: jest.fn(),
  getUserPluginAuthValue: jest.fn(),
};

jest.mock('~/server/services/PluginService', () => mockPluginService);

const { BaseLLM } = require('@langchain/openai');
const { Calculator } = require('@langchain/community/tools/calculator');

const { User } = require('~/db/models');
const PluginService = require('~/server/services/PluginService');
const { validateTools, loadTools, loadToolWithAuth } = require('./handleTools');
const { availableTools } = require('../');

describe('Tool Handlers', () => {
  let mongoServer;
  let fakeUser;
  const pluginKey = 'calculator';
  const pluginKey2 = 'wolfram';
  const ToolClass = Calculator;
  const initialTools = [pluginKey, pluginKey2];
  const mockCredential = 'mock-credential';
  const mainPlugin = availableTools.find((tool) => tool.pluginKey === pluginKey2);
  const authConfigs = mainPlugin.authConfig;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    const userAuthValues = {};
    mockPluginService.getUserPluginAuthValue.mockImplementation((userId, authField) => {
      return userAuthValues[`${userId}-${authField}`];
    });
    mockPluginService.updateUserPluginAuth.mockImplementation(
      (userId, authField, _pluginKey, credential) => {
        const fields = authField.split('||');
        fields.forEach((field) => {
          userAuthValues[`${userId}-${field}`] = credential;
        });
      },
    );

    fakeUser = new User({
      name: 'Fake User',
      username: 'fakeuser',
      email: 'fakeuser@example.com',
      emailVerified: false,
      // file deepcode ignore NoHardcodedPasswords/test: fake value
      password: 'fakepassword123',
      avatar: '',
      provider: 'local',
      role: 'USER',
      googleId: null,
      plugins: [],
      refreshToken: [],
    });
    await fakeUser.save();
    for (const authConfig of authConfigs) {
      await PluginService.updateUserPluginAuth(
        fakeUser._id,
        authConfig.authField,
        pluginKey2,
        mockCredential,
      );
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear mocks but not the database since we need the user to persist
    jest.clearAllMocks();

    // Reset the mock implementations
    const userAuthValues = {};
    mockPluginService.getUserPluginAuthValue.mockImplementation((userId, authField) => {
      return userAuthValues[`${userId}-${authField}`];
    });
    mockPluginService.updateUserPluginAuth.mockImplementation(
      (userId, authField, _pluginKey, credential) => {
        const fields = authField.split('||');
        fields.forEach((field) => {
          userAuthValues[`${userId}-${field}`] = credential;
        });
      },
    );

    // Re-add the auth configs for the user
    for (const authConfig of authConfigs) {
      await PluginService.updateUserPluginAuth(
        fakeUser._id,
        authConfig.authField,
        pluginKey2,
        mockCredential,
      );
    }
  });

  describe('validateTools', () => {
    it('returns valid tools given input tools and user authentication', async () => {
      const validTools = await validateTools(fakeUser._id, initialTools);
      expect(validTools).toBeDefined();
      expect(validTools.some((tool) => tool === pluginKey)).toBeTruthy();
      expect(validTools.length).toBeGreaterThan(0);
    });

    it('removes tools without valid credentials from the validTools array', async () => {
      const validTools = await validateTools(fakeUser._id, initialTools);
      expect(validTools.some((tool) => tool.pluginKey === pluginKey2)).toBeFalsy();
    });

    it('returns an empty array when no authenticated tools are provided', async () => {
      const validTools = await validateTools(fakeUser._id, []);
      expect(validTools).toEqual([]);
    });

    it('should validate a tool from an Environment Variable', async () => {
      const plugin = availableTools.find((tool) => tool.pluginKey === pluginKey2);
      const authConfigs = plugin.authConfig;
      for (const authConfig of authConfigs) {
        process.env[authConfig.authField] = mockCredential;
      }
      const validTools = await validateTools(fakeUser._id, [pluginKey2]);
      expect(validTools.length).toEqual(1);
      for (const authConfig of authConfigs) {
        delete process.env[authConfig.authField];
      }
    });
  });

  describe('loadTools', () => {
    let toolFunctions;
    let loadTool1;
    let loadTool2;
    let loadTool3;
    const sampleTools = [...initialTools, 'google'];
    let ToolClass2 = Calculator;
    let remainingTools = availableTools.filter(
      (tool) => sampleTools.indexOf(tool.pluginKey) === -1,
    );

    beforeAll(async () => {
      const toolMap = await loadTools({
        user: fakeUser._id,
        model: BaseLLM,
        tools: sampleTools,
        returnMap: true,
        useSpecs: true,
      });
      toolFunctions = toolMap;
      loadTool1 = toolFunctions[sampleTools[0]];
      loadTool2 = toolFunctions[sampleTools[1]];
      loadTool3 = toolFunctions[sampleTools[2]];
    });

    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env;
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns the expected load functions for requested tools', async () => {
      expect(loadTool1).toBeDefined();
      expect(loadTool2).toBeDefined();
      expect(loadTool3).toBeDefined();

      for (const tool of remainingTools) {
        expect(toolFunctions[tool.pluginKey]).toBeUndefined();
      }
    });

    it('should initialize an authenticated tool or one without authentication', async () => {
      const authTool = await loadTool1();
      const tool = await loadTool3();
      expect(authTool).toBeInstanceOf(ToolClass);
      expect(tool).toBeDefined();
    });

    it('should initialize an authenticated tool with primary auth field', async () => {
      process.env.GOOGLE_API_KEY = 'mocked_api_key';
      const initToolFunction = loadToolWithAuth(
        'userId',
        ['GOOGLE_API_KEY'],
        ToolClass,
      );
      const authTool = await initToolFunction();

      expect(authTool).toBeInstanceOf(ToolClass);
      expect(mockPluginService.getUserPluginAuthValue).not.toHaveBeenCalled();
    });

    it('should fallback to getUserPluginAuthValue when env vars are missing', async () => {
      mockPluginService.updateUserPluginAuth('userId', 'GOOGLE_API_KEY', 'google', 'mocked_api_key');
      const initToolFunction = loadToolWithAuth(
        'userId',
        ['GOOGLE_API_KEY'],
        ToolClass,
      );
      const authTool = await initToolFunction();

      expect(authTool).toBeInstanceOf(ToolClass);
      expect(mockPluginService.getUserPluginAuthValue).toHaveBeenCalledTimes(1);
    });

    it('should throw an error for an unauthenticated tool', async () => {
      try {
        await loadTool2();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
    
    it('returns an empty object when no tools are requested', async () => {
      toolFunctions = await loadTools({
        user: fakeUser._id,
        model: BaseLLM,
        returnMap: true,
        useSpecs: true,
      });
      expect(toolFunctions).toEqual({});
    });
    
    it('should return the Tool version when using functions', async () => {
      process.env.GOOGLE_API_KEY = mockCredential;
      toolFunctions = await loadTools({
        user: fakeUser._id,
        model: BaseLLM,
        tools: ['calculator'],
        functions: true,
        returnMap: true,
        useSpecs: true,
      });
      const calculatorTool = await toolFunctions['calculator']();
      expect(calculatorTool).toBeInstanceOf(Calculator);
      delete process.env.GOOGLE_API_KEY;
    });
  });
});
