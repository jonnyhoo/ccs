#!/usr/bin/env node
'use strict';

/**
 * ReasoningEnforcer Unit Tests
 *
 * Test scenarios:
 * 1. Opt-in behavior (enabled vs disabled)
 * 2. System message injection
 * 3. User message fallback
 * 4. Effort level selection (low/medium/high/max)
 * 5. Message structure handling (string vs array)
 * 6. Edge cases (empty messages, no system/user)
 */

const ReasoningEnforcer = require('../../../dist/glmt/reasoning-enforcer').default;

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
    console.log('\n=== ReasoningEnforcer Tests ===\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`[OK] ${name}`);
        this.passed++;
      } catch (error) {
        console.error(`[X] ${name}`);
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

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || 'Expected condition to be true');
  }
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(
      `${message || 'String does not include expected substring'}\n` +
      `  Expected substring: ${needle}\n` +
      `  Actual string: ${haystack.substring(0, 100)}...`
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || 'Deep equality assertion failed'}\n` +
      `  Expected: ${expectedStr}\n` +
      `  Actual: ${actualStr}`
    );
  }
}

// Create test runner
const runner = new TestRunner();

// Test 1: Opt-in behavior - disabled
runner.test('should NOT inject when disabled and thinking=false', () => {
  const enforcer = new ReasoningEnforcer({ enabled: false });
  const messages = [
    { role: 'user', content: 'What is 2+2?' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: false });

  assertEqual(result.length, 1);
  assertEqual(result[0].content, 'What is 2+2?');
});

// Test 2: Opt-in behavior - enabled
runner.test('should inject when enabled=true', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [
    { role: 'user', content: 'What is 2+2?' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: false });

  assertIncludes(result[0].content, 'CRITICAL');
  assertIncludes(result[0].content, '<reasoning_content>');
});

// Test 3: Opt-in behavior - thinking=true
runner.test('should inject when thinking=true (even if enabled=false)', () => {
  const enforcer = new ReasoningEnforcer({ enabled: false });
  const messages = [
    { role: 'user', content: 'What is 2+2?' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertIncludes(result[0].content, 'CRITICAL');
});

// Test 4: System message injection - string content
runner.test('should prepend to system message (string content)', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Calculate 2+2' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'medium' });

  assertEqual(result.length, 2);
  assertTrue(result[0].content.startsWith('You are an expert reasoning model'));
  assertIncludes(result[0].content, 'You are a helpful assistant');
  assertEqual(result[1].content, 'Calculate 2+2');
});

// Test 5: System message injection - array content
runner.test('should prepend to system message (array content)', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [
    {
      role: 'system',
      content: [
        { type: 'text', text: 'You are a code assistant.' }
      ]
    },
    { role: 'user', content: 'Write a function' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertTrue(Array.isArray(result[0].content));
  assertEqual(result[0].content[0].type, 'text');
  assertIncludes(result[0].content[0].text, 'CRITICAL');
  assertEqual(result[0].content[1].text, 'You are a code assistant.');
});

// Test 6: User message fallback
runner.test('should prepend to first user message when no system message', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [
    { role: 'user', content: 'Explain quantum computing' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertEqual(result.length, 1);
  assertIncludes(result[0].content, 'CRITICAL');
  assertIncludes(result[0].content, 'Explain quantum computing');
});

// Test 7: Effort level - low
runner.test('should use low prompt template', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'low' });

  assertIncludes(result[0].content.toLowerCase(), 'brief analysis');
});

// Test 8: Effort level - medium
runner.test('should use medium prompt template', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'medium' });

  assertIncludes(result[0].content.toLowerCase(), 'think step-by-step');
});

// Test 9: Effort level - high
runner.test('should use high prompt template', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'high' });

  assertIncludes(result[0].content.toLowerCase(), 'think deeply and systematically');
});

// Test 10: Effort level - max
runner.test('should use max prompt template', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'max' });

  assertIncludes(result[0].content.toLowerCase(), 'exhaustively from first principles');
});

// Test 11: Default effort level
runner.test('should default to medium effort if not specified', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertIncludes(result[0].content, 'think step-by-step');
});

// Test 12: Empty messages array
runner.test('should handle empty messages array', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertEqual(result.length, 0);
});

// Test 13: No system or user role
runner.test('should handle messages with no system or user role', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const messages = [
    { role: 'assistant', content: 'Previous response' }
  ];

  const result = enforcer.injectInstruction(messages, { thinking: true });

  assertEqual(result.length, 1);
  assertEqual(result[0].content, 'Previous response');
});

// Test 14: Immutability
runner.test('should not mutate original messages array', () => {
  const enforcer = new ReasoningEnforcer({ enabled: true });
  const originalMessages = [
    { role: 'user', content: 'Test prompt' }
  ];
  const originalCopy = JSON.parse(JSON.stringify(originalMessages));

  enforcer.injectInstruction(originalMessages, { thinking: true });

  assertDeepEqual(originalMessages, originalCopy);
});

// Test 15: Custom prompts
runner.test('should handle custom prompts via constructor', () => {
  const customPrompts = {
    low: 'Custom low prompt',
    medium: 'Custom medium prompt',
    high: 'Custom high prompt',
    max: 'Custom max prompt'
  };
  const enforcer = new ReasoningEnforcer({ enabled: true, prompts: customPrompts });
  const messages = [{ role: 'user', content: 'Test' }];

  const result = enforcer.injectInstruction(messages, { thinking: true, effort: 'low' });

  assertIncludes(result[0].content, 'Custom low prompt');
});

// Run all tests
runner.run().then(success => {
  process.exit(success ? 0 : 1);
});
