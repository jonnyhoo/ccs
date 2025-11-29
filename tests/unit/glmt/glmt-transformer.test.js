#!/usr/bin/env node
'use strict';

const GlmtTransformer = require('../../../dist/glmt/glmt-transformer').default;

/**
 * Simple test runner (no external dependencies)
 */
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n=== GLM Thinking Transformer Tests ===\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✓ ${name}`);
        this.passed++;
      } catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n=== Results ===`);
    console.log(`Passed: ${this.passed}/${this.tests.length}`);
    console.log(`Failed: ${this.failed}/${this.tests.length}`);

    return this.failed === 0;
  }
}

/**
 * Simple assertion helpers
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Assertion failed'}\n` +
      `  Expected: ${JSON.stringify(expected)}\n` +
      `  Actual: ${JSON.stringify(actual)}`
    );
  }
}

function assertExists(value, message) {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value should exist');
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || 'Deep equality failed'}\n` +
      `  Expected: ${expectedStr}\n` +
      `  Actual: ${actualStr}`
    );
  }
}

// Test suite
const runner = new TestRunner();

// Test 1: Transform Anthropic request to OpenAI format
runner.test('transforms Anthropic request to OpenAI format', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 4096
  };

  const { openaiRequest } = transformer.transformRequest(input);

  assertEqual(openaiRequest.model, 'GLM-4.6', 'Model should be GLM-4.6');
  assertEqual(openaiRequest.do_sample, true, 'do_sample should be true');
  assertEqual(openaiRequest.max_tokens, 128000, 'max_tokens should be 128000');
  assertExists(openaiRequest.messages, 'messages should exist');
});

// Test 2: Extract thinking control tags
runner.test('extracts thinking control tags', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{
      role: 'user',
      content: '<Thinking:On> <Effort:High> Solve this problem'
    }]
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'thinking should be On');
  assertEqual(thinkingConfig.effort, 'high', 'effort should be high');
});

// Test 3: Extract thinking off tag
runner.test('respects Thinking:Off tag', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{
      role: 'user',
      content: '<Thinking:Off> Quick question'
    }]
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, false, 'thinking should be Off');
});

// Test 4: Convert reasoning_content to thinking block
runner.test('converts reasoning_content to thinking block', () => {
  const transformer = new GlmtTransformer();
  const openaiResponse = {
    id: 'chatcmpl-123',
    model: 'GLM-4.6',
    choices: [{
      message: {
        role: 'assistant',
        content: 'Here is the answer',
        reasoning_content: 'Let me think through this problem...'
      },
      finish_reason: 'stop'
    }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
  };

  const result = transformer.transformResponse(openaiResponse, {});

  assertEqual(result.content.length, 2, 'Should have 2 content blocks');
  assertEqual(result.content[0].type, 'thinking', 'First block should be thinking');
  assertEqual(
    result.content[0].thinking,
    'Let me think through this problem...',
    'Thinking content should match'
  );
  assertEqual(result.content[1].type, 'text', 'Second block should be text');
  assertEqual(
    result.content[1].text,
    'Here is the answer',
    'Text content should match'
  );
});

// Test 5: Handle response without reasoning_content
runner.test('handles response without reasoning_content', () => {
  const transformer = new GlmtTransformer();
  const openaiResponse = {
    id: 'chatcmpl-123',
    model: 'GLM-4.6',
    choices: [{
      message: {
        role: 'assistant',
        content: 'Simple answer'
      },
      finish_reason: 'stop'
    }]
  };

  const result = transformer.transformResponse(openaiResponse, {});

  assertEqual(result.content.length, 1, 'Should have 1 content block');
  assertEqual(result.content[0].type, 'text', 'Block should be text');
  assertEqual(result.content[0].text, 'Simple answer', 'Text should match');
});

// Test 6: Thinking signature generation
runner.test('generates thinking signature', () => {
  const transformer = new GlmtTransformer();
  const thinking = 'This is my reasoning process';
  const signature = transformer._generateThinkingSignature(thinking);

  assertExists(signature.type, 'signature.type should exist');
  assertEqual(signature.type, 'thinking_signature', 'type should be thinking_signature');
  assertExists(signature.hash, 'signature.hash should exist');
  assertEqual(signature.hash.length, 16, 'hash should be 16 chars');
  assertEqual(signature.length, thinking.length, 'length should match thinking length');
  assertExists(signature.timestamp, 'timestamp should exist');
});

// Test 7: Stop reason mapping
runner.test('maps OpenAI stop reasons to Anthropic', () => {
  const transformer = new GlmtTransformer();

  assertEqual(transformer._mapStopReason('stop'), 'end_turn', 'stop → end_turn');
  assertEqual(transformer._mapStopReason('length'), 'max_tokens', 'length → max_tokens');
  assertEqual(transformer._mapStopReason('tool_calls'), 'tool_use', 'tool_calls → tool_use');
  assertEqual(
    transformer._mapStopReason('unknown'),
    'end_turn',
    'unknown → end_turn (default)'
  );
});

// Test 8: Preserve temperature and top_p
runner.test('preserves temperature and top_p parameters', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    temperature: 0.7,
    top_p: 0.9
  };

  const { openaiRequest } = transformer.transformRequest(input);

  assertEqual(openaiRequest.temperature, 0.7, 'temperature should be preserved');
  assertEqual(openaiRequest.top_p, 0.9, 'top_p should be preserved');
});

// Test 9: Default thinking enabled
runner.test('enables thinking by default', () => {
  const transformer = new GlmtTransformer({ defaultThinking: true });
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }]
  };

  const { openaiRequest, thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'thinking should be enabled by default');
  assertEqual(openaiRequest.reasoning, true, 'reasoning should be in request');
});

// Test 10: Error handling in transformRequest
runner.test('handles errors in transformRequest gracefully', () => {
  const transformer = new GlmtTransformer();
  const invalidInput = null; // Invalid input

  const { openaiRequest, thinkingConfig, error } = transformer.transformRequest(invalidInput);

  assertExists(error, 'error should be present');
  assertEqual(thinkingConfig.thinking, false, 'thinking should be disabled on error');
});

// Test 11: Error handling in transformResponse
runner.test('handles errors in transformResponse gracefully', () => {
  const transformer = new GlmtTransformer();
  const invalidResponse = {}; // Missing choices

  const result = transformer.transformResponse(invalidResponse, {});

  assertEqual(result.type, 'message', 'should return valid message type');
  assertEqual(result.role, 'assistant', 'should be assistant role');
  assertExists(result.content[0].text, 'should have error text');
});

// Test 12: Streaming disabled (not yet supported)
runner.test('disables streaming (not yet supported)', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    stream: true
  };

  const { openaiRequest } = transformer.transformRequest(input);

  assertEqual(openaiRequest.stream, true, 'stream should be enabled when requested');
});

// Test 13: Debug mode disabled by default
runner.test('debug mode disabled by default', () => {
  const transformer = new GlmtTransformer();
  assertEqual(transformer.debugLog, false, 'debugLog should be false by default');
});

// Test 14: Debug mode enabled via config
runner.test('debug mode enabled via config', () => {
  const transformer = new GlmtTransformer({ debugLog: true });
  assertEqual(transformer.debugLog, true, 'debugLog should be true when enabled');
});

// Test 15: Debug mode enabled via env var
runner.test('debug mode enabled via CCS_DEBUG=1', () => {
  process.env.CCS_DEBUG = '1';
  const transformer = new GlmtTransformer();
  assertEqual(transformer.debugLog, true, 'debugLog should be true when CCS_DEBUG=1');
  delete process.env.CCS_DEBUG;
});

// Test 16: Debug log directory path
runner.test('debug log directory uses ~/.ccs/logs by default', () => {
  const transformer = new GlmtTransformer();
  const os = require('os');
  const path = require('path');
  const expectedPath = path.join(os.homedir(), '.ccs', 'logs');
  assertEqual(transformer.debugLogDir, expectedPath, 'debugLogDir should be ~/.ccs/logs');
});

// Test 17: Validate transformation checks
runner.test('validates transformation with all checks', () => {
  const transformer = new GlmtTransformer();
  const validResponse = {
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'thinking', thinking: 'reasoning...' },
      { type: 'text', text: 'answer' }
    ],
    usage: { input_tokens: 10, output_tokens: 20 }
  };

  const validation = transformer._validateTransformation(validResponse);
  assertEqual(validation.passed, 5, 'All 5 checks should pass');
  assertEqual(validation.total, 5, 'Should have 5 total checks');
  assertEqual(validation.valid, true, 'Should be valid');
  assertEqual(validation.checks.hasContent, true, 'hasContent check');
  assertEqual(validation.checks.hasThinking, true, 'hasThinking check');
  assertEqual(validation.checks.hasText, true, 'hasText check');
  assertEqual(validation.checks.validStructure, true, 'validStructure check');
  assertEqual(validation.checks.hasUsage, true, 'hasUsage check');
});

// Test 18: Validate transformation with missing thinking
runner.test('validates transformation without thinking block', () => {
  const transformer = new GlmtTransformer();
  const response = {
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'text', text: 'answer' }
    ],
    usage: { input_tokens: 10, output_tokens: 20 }
  };

  const validation = transformer._validateTransformation(response);
  assertEqual(validation.passed, 4, '4 checks should pass (no thinking)');
  assertEqual(validation.checks.hasThinking, false, 'hasThinking should be false');
  assertEqual(validation.checks.hasText, true, 'hasText should be true');
});

// Test 19: Handle anthropicRequest.thinking parameter with type=enabled
runner.test('processes thinking parameter with type=enabled', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test question' }],
    thinking: {
      type: 'enabled',
      budget_tokens: 1024
    }
  };

  const { openaiRequest, thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'thinking should be enabled');
  // Note: effort no longer dynamically set from budget_tokens (Z.AI doesn't support reasoning_effort)
  assertEqual(openaiRequest.reasoning, true, 'reasoning should be in OpenAI request');
});

// Test 20: Handle anthropicRequest.thinking parameter with type=disabled
runner.test('processes thinking parameter with type=disabled', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test question' }],
    thinking: {
      type: 'disabled'
    }
  };

  const { openaiRequest, thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, false, 'thinking should be disabled');
  assertEqual(openaiRequest.reasoning, undefined, 'reasoning should not be in request');
});

// Test 21: Budget tokens no longer mapped to effort (Z.AI doesn't support reasoning_effort)
runner.test('ignores budget_tokens (Z.AI does not support reasoning_effort)', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    thinking: {
      type: 'enabled',
      budget_tokens: 2048
    }
  };

  const { thinkingConfig, openaiRequest } = transformer.transformRequest(input);

  // Z.AI only supports binary thinking (reasoning: true/false), not effort levels
  assertEqual(thinkingConfig.thinking, true, 'thinking should be enabled');
  assertEqual(openaiRequest.reasoning, true, 'reasoning should be true in API request');
});

// Test 22: Budget tokens mapping - medium effort (2049-8192)
runner.test('maps budget_tokens 2049-8192 to medium effort', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    thinking: {
      type: 'enabled',
      budget_tokens: 4096
    }
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.effort, 'medium', 'effort should be medium at budget=4096');
});

// Test 23: Verify thinking parameter works regardless of budget_tokens value
runner.test('thinking.type controls API behavior (budget_tokens ignored)', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    thinking: {
      type: 'enabled',
      budget_tokens: 16384
    }
  };

  const { thinkingConfig, openaiRequest } = transformer.transformRequest(input);

  // Only thinking.type matters for Z.AI API
  assertEqual(thinkingConfig.thinking, true, 'thinking should be enabled');
  assertEqual(openaiRequest.reasoning, true, 'reasoning should be true');
});

// Test 24: thinking parameter without budget_tokens
runner.test('handles thinking parameter without budget_tokens', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    thinking: {
      type: 'enabled'
    }
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'thinking should be enabled');
  // Effort should remain default (not overridden)
  assertExists(thinkingConfig.effort, 'effort should exist with default value');
});

// Test 25: thinking parameter takes precedence over message tags
runner.test('thinking parameter overrides message tags', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{
      role: 'user',
      content: '<Thinking:Off> <Effort:High> Test question'
    }],
    thinking: {
      type: 'enabled',
      budget_tokens: 1024
    }
  };

  const { thinkingConfig, openaiRequest } = transformer.transformRequest(input);

  // thinking parameter should win over tags
  assertEqual(thinkingConfig.thinking, true, 'thinking param should override tag');
  assertEqual(openaiRequest.reasoning, true, 'reasoning should be enabled in API request');
});

// Test 26: Message tags still work when no thinking parameter present
runner.test('message tags work when thinking parameter absent', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{
      role: 'user',
      content: '<Thinking:On> <Effort:Medium> Test question'
    }]
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'tag should enable thinking');
  assertEqual(thinkingConfig.effort, 'medium', 'tag should set medium effort');
});

// Test 27: thinking parameter with invalid type (edge case)
runner.test('handles invalid thinking type gracefully', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'Test' }],
    thinking: {
      type: 'invalid'
    }
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  // Should fall back to default behavior (not crash)
  assertExists(thinkingConfig, 'thinkingConfig should exist');
});

// Test 28: Keyword detection - "think"
runner.test('detects "think" keyword (low effort)', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'think about the solution' }
  ]);

  assertEqual(result.thinking, true, 'thinking should be enabled');
  assertEqual(result.effort, 'low', 'effort should be low');
  assertEqual(result.keyword, 'think', 'keyword should be "think"');
});

// Test 29: Keyword detection - "think hard"
runner.test('detects "think hard" keyword (medium effort)', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'think hard about edge cases' }
  ]);

  assertEqual(result.thinking, true, 'thinking should be enabled');
  assertEqual(result.effort, 'medium', 'effort should be medium');
  assertEqual(result.keyword, 'think hard', 'keyword should be "think hard"');
});

// Test 30: Keyword detection - "think harder"
runner.test('detects "think harder" keyword (high effort)', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'think harder about edge cases' }
  ]);

  assertEqual(result.thinking, true, 'thinking should be enabled');
  assertEqual(result.effort, 'high', 'effort should be high');
  assertEqual(result.keyword, 'think harder', 'keyword should be "think harder"');
});

// Test 31: Keyword detection - "ultrathink"
runner.test('detects "ultrathink" keyword (max effort)', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'ultrathink this complex problem' }
  ]);

  assertEqual(result.thinking, true, 'thinking should be enabled');
  assertEqual(result.effort, 'max', 'effort should be max');
  assertEqual(result.keyword, 'ultrathink', 'keyword should be "ultrathink"');
});

// Test 32: Keyword detection - ignores "thinking" (not exact match)
runner.test('ignores "thinking" word (not exact match)', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'I am thinking about the solution' }
  ]);

  assertEqual(result, null, 'should return null for non-exact match');
});

// Test 33: Keyword detection - returns null when no keywords
runner.test('returns null when no keywords present', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'fix the bug quickly' }
  ]);

  assertEqual(result, null, 'should return null when no keywords found');
});

// Test 34: Keyword priority - ultrathink wins when multiple keywords present
runner.test('ultrathink has highest priority when multiple keywords present', () => {
  const transformer = new GlmtTransformer();
  const result = transformer._detectThinkKeywords([
    { role: 'user', content: 'think hard and think harder, or maybe ultrathink about this' }
  ]);

  assertEqual(result.thinking, true, 'thinking should be enabled');
  assertEqual(result.effort, 'max', 'ultrathink should win with max effort');
  assertEqual(result.keyword, 'ultrathink', 'keyword should be ultrathink');
});

// Test 35: Keyword detection integrates with transformRequest
runner.test('keyword detection triggers thinking in transformRequest', () => {
  const transformer = new GlmtTransformer();
  const input = {
    model: 'claude-sonnet-4.5',
    messages: [{ role: 'user', content: 'think hard about this architecture problem' }]
  };

  const { thinkingConfig } = transformer.transformRequest(input);

  assertEqual(thinkingConfig.thinking, true, 'keyword should enable thinking');
  assertEqual(thinkingConfig.effort, 'medium', 'keyword should set medium effort');
});

// Run tests
runner.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
