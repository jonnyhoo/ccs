#!/usr/bin/env node
'use strict';

const SSEParser = require('../../../dist/glmt/sse-parser').default;

console.log('[TEST] SSEParser unit tests');
console.log('');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`[FAIL] ${name}`);
    console.log(`  Error: ${error.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test: Single event
test('Single event parsing', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: {"test": "value"}\n\n');
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  assert(events[0].data.test === 'value', `Expected test=value, got ${events[0].data.test}`);
});

// Test: Multiple events
test('Multiple events in one chunk', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: {"a": 1}\n\ndata: {"b": 2}\n\n');
  assert(events.length === 2, `Expected 2 events, got ${events.length}`);
  assert(events[0].data.a === 1, 'First event data incorrect');
  assert(events[1].data.b === 2, 'Second event data incorrect');
});

// Test: Split across chunks
test('Event split across chunks', () => {
  const parser = new SSEParser();
  const events1 = parser.parse('data: {"test":');
  assert(events1.length === 0, 'Should not emit incomplete event');
  const events2 = parser.parse('"value"}\n\n');
  assert(events2.length === 1, `Expected 1 event after completion, got ${events2.length}`);
  assert(events2[0].data.test === 'value', 'Split event data incorrect');
});

// Test: [DONE] marker
test('[DONE] marker detection', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: [DONE]\n\n');
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  assert(events[0].event === 'done', `Expected event=done, got ${events[0].event}`);
  assert(events[0].data === null, 'Expected null data for [DONE]');
});

// Test: Mixed content and [DONE]
test('Mixed events with [DONE]', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: {"msg": "hello"}\n\ndata: [DONE]\n\n');
  assert(events.length === 2, `Expected 2 events, got ${events.length}`);
  assert(events[0].data.msg === 'hello', 'First event data incorrect');
  assert(events[1].event === 'done', 'Second event should be done');
});

// Test: Malformed JSON (should skip gracefully)
test('Malformed JSON handling', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: {invalid json}\n\ndata: {"valid": true}\n\n');
  // Should skip malformed, parse valid
  assert(events.length === 1, `Expected 1 valid event, got ${events.length}`);
  assert(events[0].data.valid === true, 'Valid event data incorrect');
});

// Test: Empty lines handling
test('Empty lines between events', () => {
  const parser = new SSEParser();
  const events = parser.parse('data: {"a": 1}\n\n\n\ndata: {"b": 2}\n\n');
  assert(events.length === 2, `Expected 2 events, got ${events.length}`);
});

// Test: Event with ID field
test('Event with ID field', () => {
  const parser = new SSEParser();
  const events = parser.parse('id: 123\ndata: {"test": true}\n\n');
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  assert(events[0].id === '123', `Expected id=123, got ${events[0].id}`);
  assert(events[0].data.test === true, 'Event data incorrect');
});

// Test: Custom event type
test('Custom event type', () => {
  const parser = new SSEParser();
  const events = parser.parse('event: custom\ndata: {"test": true}\n\n');
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  assert(events[0].event === 'custom', `Expected event=custom, got ${events[0].event}`);
});

// Test: Reset functionality
test('Parser reset', () => {
  const parser = new SSEParser();
  parser.parse('data: {"test": 1}\n\n');
  assert(parser.eventCount === 1, 'Event count should be 1');
  parser.reset();
  assert(parser.eventCount === 0, 'Event count should be 0 after reset');
  assert(parser.buffer === '', 'Buffer should be empty after reset');
});

// Test: Real Z.AI stream format
test('Real Z.AI stream format', () => {
  const parser = new SSEParser();
  const chunk = 'data: {"choices":[{"delta":{"role":"assistant","reasoning_content":"test"}}]}\n\n';
  const events = parser.parse(chunk);
  assert(events.length === 1, `Expected 1 event, got ${events.length}`);
  assert(events[0].data.choices[0].delta.reasoning_content === 'test', 'Z.AI format parsing incorrect');
});

// Test: Multiple Z.AI deltas
test('Multiple Z.AI deltas', () => {
  const parser = new SSEParser();
  const chunk = 'data: {"choices":[{"delta":{"reasoning_content":"chunk1"}}]}\n\ndata: {"choices":[{"delta":{"reasoning_content":"chunk2"}}]}\n\n';
  const events = parser.parse(chunk);
  assert(events.length === 2, `Expected 2 events, got ${events.length}`);
  assert(events[0].data.choices[0].delta.reasoning_content === 'chunk1', 'First delta incorrect');
  assert(events[1].data.choices[0].delta.reasoning_content === 'chunk2', 'Second delta incorrect');
});

console.log('');
console.log('═══════════════════════════════════════');
console.log(`TESTS: ${passedTests} passed, ${failedTests} failed`);
console.log('═══════════════════════════════════════');

if (failedTests > 0) {
  process.exit(1);
}
