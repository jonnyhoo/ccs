/**
 * Tests for CLIProxy Model Catalog
 * Verifies model database structure and lookup functions
 */

const assert = require('assert');

describe('Model Catalog', () => {
  const modelCatalog = require('../../../dist/cliproxy/model-catalog');

  describe('MODEL_CATALOG structure', () => {
    it('contains AGY provider catalog', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert(MODEL_CATALOG.agy, 'Should have agy provider');
      assert.strictEqual(MODEL_CATALOG.agy.provider, 'agy');
      assert.strictEqual(MODEL_CATALOG.agy.displayName, 'Antigravity');
    });

    it('contains Gemini provider catalog', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert(MODEL_CATALOG.gemini, 'Should have gemini provider');
      assert.strictEqual(MODEL_CATALOG.gemini.provider, 'gemini');
      assert.strictEqual(MODEL_CATALOG.gemini.displayName, 'Gemini');
    });

    it('does not contain codex or qwen (not configurable)', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert.strictEqual(MODEL_CATALOG.codex, undefined);
      assert.strictEqual(MODEL_CATALOG.qwen, undefined);
    });
  });

  describe('AGY models', () => {
    it('has correct default model', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert.strictEqual(MODEL_CATALOG.agy.defaultModel, 'gemini-3-pro-preview');
    });

    it('includes Claude Opus 4.5 Thinking', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const opus = MODEL_CATALOG.agy.models.find(
        (m) => m.id === 'gemini-claude-opus-4-5-thinking'
      );
      assert(opus, 'Should include Claude Opus 4.5 Thinking');
      assert.strictEqual(opus.name, 'Claude Opus 4.5 Thinking');
    });

    it('includes Claude Sonnet 4.5 Thinking', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const sonnetThinking = MODEL_CATALOG.agy.models.find(
        (m) => m.id === 'gemini-claude-sonnet-4-5-thinking'
      );
      assert(sonnetThinking, 'Should include Claude Sonnet 4.5 Thinking');
      assert.strictEqual(sonnetThinking.name, 'Claude Sonnet 4.5 Thinking');
    });

    it('includes Claude Sonnet 4.5', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const sonnet = MODEL_CATALOG.agy.models.find((m) => m.id === 'gemini-claude-sonnet-4-5');
      assert(sonnet, 'Should include Claude Sonnet 4.5');
      assert.strictEqual(sonnet.name, 'Claude Sonnet 4.5');
    });

    it('includes Gemini 3 Pro with paid tier', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const gem3 = MODEL_CATALOG.agy.models.find((m) => m.id === 'gemini-3-pro-preview');
      assert(gem3, 'Should include Gemini 3 Pro');
      assert.strictEqual(gem3.name, 'Gemini 3 Pro');
      assert.strictEqual(gem3.tier, 'paid');
    });

    it('has 4 models total', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert.strictEqual(MODEL_CATALOG.agy.models.length, 4);
    });
  });

  describe('Gemini models', () => {
    it('has correct default model', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert.strictEqual(MODEL_CATALOG.gemini.defaultModel, 'gemini-2.5-pro');
    });

    it('includes Gemini 3 Pro with paid tier', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const gem3 = MODEL_CATALOG.gemini.models.find((m) => m.id === 'gemini-3-pro-preview');
      assert(gem3, 'Should include Gemini 3 Pro');
      assert.strictEqual(gem3.name, 'Gemini 3 Pro');
      assert.strictEqual(gem3.tier, 'paid');
    });

    it('includes Gemini 2.5 Pro without tier (free)', () => {
      const { MODEL_CATALOG } = modelCatalog;
      const gem25 = MODEL_CATALOG.gemini.models.find((m) => m.id === 'gemini-2.5-pro');
      assert(gem25, 'Should include Gemini 2.5 Pro');
      assert.strictEqual(gem25.name, 'Gemini 2.5 Pro');
      assert.strictEqual(gem25.tier, undefined);
    });

    it('has 2 models total', () => {
      const { MODEL_CATALOG } = modelCatalog;
      assert.strictEqual(MODEL_CATALOG.gemini.models.length, 2);
    });
  });

  describe('supportsModelConfig', () => {
    it('returns true for agy', () => {
      const { supportsModelConfig } = modelCatalog;
      assert.strictEqual(supportsModelConfig('agy'), true);
    });

    it('returns true for gemini', () => {
      const { supportsModelConfig } = modelCatalog;
      assert.strictEqual(supportsModelConfig('gemini'), true);
    });

    it('returns false for codex', () => {
      const { supportsModelConfig } = modelCatalog;
      assert.strictEqual(supportsModelConfig('codex'), false);
    });

    it('returns false for qwen', () => {
      const { supportsModelConfig } = modelCatalog;
      assert.strictEqual(supportsModelConfig('qwen'), false);
    });
  });

  describe('getProviderCatalog', () => {
    it('returns catalog for agy', () => {
      const { getProviderCatalog } = modelCatalog;
      const catalog = getProviderCatalog('agy');
      assert(catalog, 'Should return catalog');
      assert.strictEqual(catalog.provider, 'agy');
      assert(Array.isArray(catalog.models));
    });

    it('returns catalog for gemini', () => {
      const { getProviderCatalog } = modelCatalog;
      const catalog = getProviderCatalog('gemini');
      assert(catalog, 'Should return catalog');
      assert.strictEqual(catalog.provider, 'gemini');
    });

    it('returns undefined for codex', () => {
      const { getProviderCatalog } = modelCatalog;
      const catalog = getProviderCatalog('codex');
      assert.strictEqual(catalog, undefined);
    });
  });

  describe('findModel', () => {
    it('finds Claude Opus 4.5 Thinking in agy', () => {
      const { findModel } = modelCatalog;
      const model = findModel('agy', 'gemini-claude-opus-4-5-thinking');
      assert(model, 'Should find model');
      assert.strictEqual(model.name, 'Claude Opus 4.5 Thinking');
    });

    it('finds Gemini 2.5 Pro in gemini', () => {
      const { findModel } = modelCatalog;
      const model = findModel('gemini', 'gemini-2.5-pro');
      assert(model, 'Should find model');
      assert.strictEqual(model.name, 'Gemini 2.5 Pro');
    });

    it('returns undefined for unknown model', () => {
      const { findModel } = modelCatalog;
      const model = findModel('agy', 'unknown-model');
      assert.strictEqual(model, undefined);
    });

    it('returns undefined for unsupported provider', () => {
      const { findModel } = modelCatalog;
      const model = findModel('codex', 'any-model');
      assert.strictEqual(model, undefined);
    });
  });

  describe('Model entry structure', () => {
    it('all models have required fields', () => {
      const { MODEL_CATALOG } = modelCatalog;

      for (const [provider, catalog] of Object.entries(MODEL_CATALOG)) {
        for (const model of catalog.models) {
          assert(model.id, `Model in ${provider} should have id`);
          assert(typeof model.id === 'string', `Model id should be string`);
          assert(model.name, `Model ${model.id} should have name`);
          assert(typeof model.name === 'string', `Model name should be string`);
          // tier is optional
          if (model.tier !== undefined) {
            assert(['free', 'paid'].includes(model.tier), `Invalid tier: ${model.tier}`);
          }
        }
      }
    });

    it('all model IDs are unique within provider', () => {
      const { MODEL_CATALOG } = modelCatalog;

      for (const [provider, catalog] of Object.entries(MODEL_CATALOG)) {
        const ids = catalog.models.map((m) => m.id);
        const uniqueIds = new Set(ids);
        assert.strictEqual(ids.length, uniqueIds.size, `Duplicate model IDs in ${provider}`);
      }
    });

    it('default model exists in models array', () => {
      const { MODEL_CATALOG } = modelCatalog;

      for (const [provider, catalog] of Object.entries(MODEL_CATALOG)) {
        const defaultExists = catalog.models.some((m) => m.id === catalog.defaultModel);
        assert(defaultExists, `Default model ${catalog.defaultModel} not found in ${provider}`);
      }
    });
  });
});
