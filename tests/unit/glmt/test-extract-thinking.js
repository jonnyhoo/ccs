#!/usr/bin/env node
'use strict';

/**
 * Unit test for _extractThinkingControl method
 * Tests different message formats to understand the bug
 */

const GlmtTransformer = require('../../../dist/glmt/glmt-transformer').default;

const transformer = new GlmtTransformer({ verbose: true });

console.log('Testing _extractThinkingControl with different message formats\n');
console.log('='.repeat(60));

// Test 1: First message (string content)
const test1 = {
  messages: [
    {
      role: 'user',
      content: 'Calculate 15 factorial'
    }
  ]
};

console.log('\nTest 1: First message (string content)');
console.log('Input:', JSON.stringify(test1.messages, null, 2));
const result1 = transformer._extractThinkingControl(test1.messages);
console.log('Result:', result1);
console.log('Expected: { thinking: true, effort: "medium" }');
console.log('Status:', result1.thinking === true ? '✓ PASS' : '✗ FAIL');

// Test 2: Second message with previous assistant response (array content)
const test2 = {
  messages: [
    {
      role: 'user',
      content: 'Calculate 15 factorial'
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'thinking',
          thinking: '15! = 15 × 14 × ... × 1'
        },
        {
          type: 'text',
          text: 'The factorial of 15 is 1,307,674,368,000'
        }
      ]
    },
    {
      role: 'user',
      content: 'What is the square root of 2?'
    }
  ]
};

console.log('\n' + '='.repeat(60));
console.log('\nTest 2: Second message (with previous conversation)');
console.log('Input messages count:', test2.messages.length);
console.log('User message 1:', test2.messages[0].content);
console.log('Assistant message:', test2.messages[1].content.length, 'blocks');
console.log('User message 2:', test2.messages[2].content);
const result2 = transformer._extractThinkingControl(test2.messages);
console.log('Result:', result2);
console.log('Expected: { thinking: true, effort: "medium" }');
console.log('Status:', result2.thinking === true ? '✓ PASS' : '✗ FAIL');

// Test 3: User message with array content (edge case)
const test3 = {
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Calculate something'
        }
      ]
    }
  ]
};

console.log('\n' + '='.repeat(60));
console.log('\nTest 3: User message with array content');
console.log('Input:', JSON.stringify(test3.messages, null, 2));
const result3 = transformer._extractThinkingControl(test3.messages);
console.log('Result:', result3);
console.log('Expected: { thinking: true, effort: "medium" }');
console.log('Status:', result3.thinking === true ? '✓ PASS' : '✗ FAIL');
console.log('Note: Array content skipped by "typeof content !== string" check');

// Test 4: User message with <Thinking:Off> tag
const test4 = {
  messages: [
    {
      role: 'user',
      content: '<Thinking:Off> Just give me a quick answer'
    }
  ]
};

console.log('\n' + '='.repeat(60));
console.log('\nTest 4: User message with <Thinking:Off> tag');
console.log('Input:', test4.messages[0].content);
const result4 = transformer._extractThinkingControl(test4.messages);
console.log('Result:', result4);
console.log('Expected: { thinking: false, effort: "medium" }');
console.log('Status:', result4.thinking === false ? '✓ PASS' : '✗ FAIL');

console.log('\n' + '='.repeat(60));
console.log('\n📝 Summary:');
console.log('  - Method only scans USER messages (assistant skipped)');
console.log('  - String content: Scanned for control tags');
console.log('  - Array content: SKIPPED (no control tag extraction)');
console.log('  - Default: thinking = true');
console.log('\n❓ Potential Issue:');
console.log('  If Claude CLI sends user messages as arrays in subsequent');
console.log('  messages, control tags wont be detected.');
console.log('  But this should still default to thinking=true...');
console.log('\n🔍 Need to verify actual message format from Claude CLI');
