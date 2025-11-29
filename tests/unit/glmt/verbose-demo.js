#!/usr/bin/env node
'use strict';

const GlmtTransformer = require('../../../dist/glmt/glmt-transformer').default;

console.log('=== Demo: Verbose Output with Reasoning Detection ===\n');

const transformer = new GlmtTransformer({ verbose: true, debugLog: false });

const openaiResponse = {
  id: 'demo-response',
  model: 'GLM-4.6',
  choices: [{
    message: {
      role: 'assistant',
      content: 'The answer is 42. This is based on careful analysis of the problem.',
      reasoning_content: `Let me think through this problem step by step.

First, I need to understand what's being asked. The question relates to the fundamental nature of the universe.

Based on Douglas Adams' work, we know that after Deep Thought computed for 7.5 million years, it determined that the answer to the Ultimate Question of Life, the Universe, and Everything is 42.

However, the actual question itself was never properly formulated. This suggests that knowing the answer is meaningless without understanding the question.

In a practical sense, this teaches us an important lesson about problem-solving: we must first ensure we're asking the right questions before seeking answers.

Therefore, my response will acknowledge both the famous answer and the philosophical implications of the question-answer relationship.`
    },
    finish_reason: 'stop'
  }],
  usage: { prompt_tokens: 50, completion_tokens: 150, total_tokens: 200 }
};

console.log('Transforming OpenAI response with reasoning_content to Anthropic format...\n');

const result = transformer.transformResponse(openaiResponse, { thinking: true });

console.log('\n=== Transformation Complete ===');
console.log(`\nResult structure:`);
console.log(`  Type: ${result.type}`);
console.log(`  Role: ${result.role}`);
console.log(`  Content blocks: ${result.content.length}`);
console.log(`    - Block 1: ${result.content[0].type}`);
console.log(`    - Block 2: ${result.content[1].type}`);
console.log(`  Stop reason: ${result.stop_reason}`);
console.log(`  Usage: input=${result.usage.prompt_tokens}, output=${result.usage.completion_tokens}`);
