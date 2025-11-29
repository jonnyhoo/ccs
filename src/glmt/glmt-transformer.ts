/**
 * GlmtTransformer - Convert between Anthropic and OpenAI formats with thinking and tool support
 *
 * Features:
 * - Request: Anthropic → OpenAI (inject reasoning params, transform tools)
 * - Response: OpenAI reasoning_content → Anthropic thinking blocks
 * - Tool Support: Anthropic tools ↔ OpenAI function calling (bidirectional)
 * - Streaming: Real-time tool calls with input_json deltas
 * - Debug mode: Log raw data to ~/.ccs/logs/ (CCS_DEBUG=1)
 * - Verbose mode: Console logging with timestamps
 * - Validation: Self-test transformation results
 *
 * Control Tags (in user prompt):
 *   <Thinking:On|Off>        - Enable/disable reasoning
 *   <Effort:Low|Medium|High> - Control reasoning depth
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DeltaAccumulator } from './delta-accumulator';
import { LocaleEnforcer } from './locale-enforcer';
import { ReasoningEnforcer } from './reasoning-enforcer';

// Types
interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: ThinkingSignature;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | unknown;
}

interface Message {
  role: string;
  content: string | ContentBlock[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: AnthropicTool[];
  stream?: boolean;
  thinking?: {
    type: 'enabled' | 'disabled';
    budget_tokens?: number;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequest {
  model: string;
  messages: Message[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: OpenAITool[];
  tool_choice?: string;
  stream?: boolean;
  do_sample?: boolean;
  reasoning?: boolean;
  reasoning_effort?: string;
}

interface ThinkingConfig {
  thinking: boolean;
  effort: string;
}

interface TransformResult {
  openaiRequest: OpenAIRequest | AnthropicRequest;
  thinkingConfig: ThinkingConfig;
  error?: string;
}

interface ThinkingSignature {
  type: string;
  hash: string;
  length: number;
  timestamp: number;
}

interface OpenAIToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChoice {
  message: {
    role?: string;
    content?: string | null;
    reasoning_content?: string;
    tool_calls?: OpenAIToolCall[];
  };
  delta?: {
    role?: string;
    content?: string;
    reasoning_content?: string;
    tool_calls?: OpenAIToolCallDelta[];
  };
  finish_reason?: string;
}

interface OpenAIToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIResponse {
  id?: string;
  model?: string;
  choices?: OpenAIChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface SSEEvent {
  event?: string;
  data?: OpenAIResponse & {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  };
}

interface AnthropicSSEEvent {
  event: string;
  data: Record<string, unknown>;
}

interface ValidationResult {
  checks: Record<string, boolean>;
  passed: number;
  total: number;
  valid: boolean;
}

interface GlmtTransformerConfig {
  defaultThinking?: boolean;
  verbose?: boolean;
  debugLog?: boolean;
  debugMode?: boolean;
  debugLogDir?: string;
  explicitReasoning?: boolean;
}

interface AccumulatorBlock {
  index: number;
  type: string;
  content: string;
  stopped: boolean;
}

export class GlmtTransformer {
  private defaultThinking: boolean;
  private verbose: boolean;
  private debugLog: boolean;
  private debugMode: boolean;
  debugLogDir: string; // public for external access
  private modelMaxTokens: Record<string, number>;
  private localeEnforcer: LocaleEnforcer;
  private reasoningEnforcer: ReasoningEnforcer;

  constructor(config: GlmtTransformerConfig = {}) {
    this.defaultThinking = config.defaultThinking ?? true;
    this.verbose = config.verbose || false;

    // CCS_DEBUG controls all debug logging (file + console)
    const debugEnabled = process.env.CCS_DEBUG === '1';
    this.debugLog = config.debugLog ?? debugEnabled;
    this.debugMode = config.debugMode ?? debugEnabled;

    this.debugLogDir = config.debugLogDir || path.join(os.homedir(), '.ccs', 'logs');
    this.modelMaxTokens = {
      'GLM-4.6': 128000,
      'GLM-4.5': 96000,
      'GLM-4.5-air': 16000,
    };

    // Initialize locale enforcer (always enforce English)
    this.localeEnforcer = new LocaleEnforcer();

    // Initialize reasoning enforcer (enabled by default for all GLMT usage)
    this.reasoningEnforcer = new ReasoningEnforcer({
      enabled: config.explicitReasoning ?? true,
    });
  }

  /**
   * Transform Anthropic request to OpenAI format
   */
  transformRequest(anthropicRequest: AnthropicRequest): TransformResult {
    // Log original request
    this.writeDebugLog('request-anthropic', anthropicRequest);

    try {
      // 1. Extract thinking control from messages (tags like <Thinking:On|Off>)
      const thinkingConfig = this.extractThinkingControl(anthropicRequest.messages || []);
      const hasControlTags = this.hasThinkingTags(anthropicRequest.messages || []);

      // 2. Detect "think" keywords in user prompts (Anthropic-style)
      const keywordConfig = this.detectThinkKeywords(anthropicRequest.messages || []);
      if (keywordConfig && !anthropicRequest.thinking && !hasControlTags) {
        thinkingConfig.thinking = keywordConfig.thinking;
        thinkingConfig.effort = keywordConfig.effort;
        this.log(
          `Detected think keyword: ${keywordConfig.keyword}, effort=${keywordConfig.effort}`
        );
      }

      // 3. Check anthropicRequest.thinking parameter (takes precedence)
      if (anthropicRequest.thinking) {
        if (anthropicRequest.thinking.type === 'enabled') {
          thinkingConfig.thinking = true;
          this.log('Claude CLI explicitly enabled thinking (overrides budget)');
        } else if (anthropicRequest.thinking.type === 'disabled') {
          thinkingConfig.thinking = false;
          this.log('Claude CLI explicitly disabled thinking (overrides budget)');
        } else {
          this.log(`Warning: Unknown thinking type: ${anthropicRequest.thinking.type}`);
        }
      }

      this.log(`Final thinking control: ${JSON.stringify(thinkingConfig)}`);

      // 3. Map model
      const glmModel = this.mapModel(anthropicRequest.model);

      // 4. Inject locale instruction before sanitization
      const messagesWithLocale = this.localeEnforcer.injectInstruction(
        (anthropicRequest.messages || []) as Parameters<
          typeof this.localeEnforcer.injectInstruction
        >[0]
      ) as unknown as Message[];

      // 4.5. Inject reasoning instruction (if enabled or thinking requested)
      const messagesWithReasoning = this.reasoningEnforcer.injectInstruction(
        messagesWithLocale as unknown as Parameters<
          typeof this.reasoningEnforcer.injectInstruction
        >[0],
        thinkingConfig
      ) as unknown as Message[];

      // 5. Convert to OpenAI format
      const openaiRequest: OpenAIRequest = {
        model: glmModel,
        messages: this.sanitizeMessages(messagesWithReasoning),
        max_tokens: this.getMaxTokens(glmModel),
        stream: anthropicRequest.stream ?? false,
      };

      // 5.5. Transform tools parameter if present
      if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
        openaiRequest.tools = this.transformTools(anthropicRequest.tools);
        // Always use "auto" as Z.AI doesn't support other modes
        openaiRequest.tool_choice = 'auto';
        this.log(`Transformed ${anthropicRequest.tools.length} tools for OpenAI format`);
      }

      // 6. Preserve optional parameters
      if (anthropicRequest.temperature !== undefined) {
        openaiRequest.temperature = anthropicRequest.temperature;
      }
      if (anthropicRequest.top_p !== undefined) {
        openaiRequest.top_p = anthropicRequest.top_p;
      }

      // 7. Handle streaming
      if (anthropicRequest.stream !== undefined) {
        openaiRequest.stream = anthropicRequest.stream;
      }

      // 8. Inject reasoning parameters
      this.injectReasoningParams(openaiRequest, thinkingConfig);

      // Log transformed request
      this.writeDebugLog('request-openai', openaiRequest);

      return { openaiRequest, thinkingConfig };
    } catch (error) {
      const err = error as Error;
      console.error('[glmt-transformer] Request transformation error:', err);
      // Return original request with warning
      return {
        openaiRequest: anthropicRequest,
        thinkingConfig: { thinking: false, effort: 'medium' },
        error: err.message,
      };
    }
  }

  /**
   * Transform OpenAI response to Anthropic format
   */
  transformResponse(
    openaiResponse: OpenAIResponse,
    _thinkingConfig: ThinkingConfig = { thinking: false, effort: 'medium' }
  ): AnthropicResponse {
    // Log original response
    this.writeDebugLog('response-openai', openaiResponse);

    try {
      const choice = openaiResponse.choices?.[0];
      if (!choice) {
        throw new Error('No choices in OpenAI response');
      }

      const message = choice.message;
      const content: ContentBlock[] = [];

      // Add thinking block if reasoning_content exists
      if (message.reasoning_content) {
        const length = message.reasoning_content.length;
        const lineCount = message.reasoning_content.split('\n').length;
        const preview = message.reasoning_content.substring(0, 100).replace(/\n/g, ' ').trim();

        this.log(`Detected reasoning_content:`);
        this.log(`  Length: ${length} characters`);
        this.log(`  Lines: ${lineCount}`);
        this.log(`  Preview: ${preview}...`);

        content.push({
          type: 'thinking',
          thinking: message.reasoning_content,
          signature: this.generateThinkingSignature(message.reasoning_content),
        });
      } else {
        this.log('No reasoning_content in OpenAI response');
        this.log('Note: This is expected if thinking not requested or model cannot reason');
      }

      // Add text content
      if (message.content) {
        content.push({
          type: 'text',
          text: message.content,
        });
      }

      // Handle tool_calls if present
      if (message.tool_calls && message.tool_calls.length > 0) {
        message.tool_calls.forEach((toolCall) => {
          let parsedInput: Record<string, unknown>;
          try {
            parsedInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch (parseError) {
            const err = parseError as Error;
            this.log(`Warning: Invalid JSON in tool arguments: ${err.message}`);
            parsedInput = { _error: 'Invalid JSON', _raw: toolCall.function.arguments };
          }

          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: parsedInput,
          });
        });
      }

      const anthropicResponse: AnthropicResponse = {
        id: openaiResponse.id || 'msg_' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: content,
        model: openaiResponse.model || 'glm-4.6',
        stop_reason: this.mapStopReason(choice.finish_reason || 'stop'),
        usage: {
          input_tokens: openaiResponse.usage?.prompt_tokens || 0,
          output_tokens: openaiResponse.usage?.completion_tokens || 0,
        },
      };

      // Validate transformation in verbose mode
      if (this.verbose) {
        const validation = this.validateTransformation(anthropicResponse);
        this.log(
          `Transformation validation: ${validation.passed}/${validation.total} checks passed`
        );
        if (!validation.valid) {
          this.log(`Failed checks: ${JSON.stringify(validation.checks, null, 2)}`);
        }
      }

      // Log transformed response
      this.writeDebugLog('response-anthropic', anthropicResponse);

      return anthropicResponse;
    } catch (error) {
      const err = error as Error;
      console.error('[glmt-transformer] Response transformation error:', err);
      // Return minimal valid response
      return {
        id: 'msg_error_' + Date.now(),
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '[Transformation Error] ' + err.message,
          },
        ],
        model: 'glm-4.6',
        stop_reason: 'end_turn',
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    }
  }

  /**
   * Sanitize messages for OpenAI API compatibility
   */
  private sanitizeMessages(messages: Message[]): Message[] {
    const result: Message[] = [];

    for (const msg of messages) {
      // If content is a string, add as-is
      if (typeof msg.content === 'string') {
        result.push(msg);
        continue;
      }

      // If content is an array, process blocks
      if (Array.isArray(msg.content)) {
        // Separate tool_result blocks from other content
        const toolResults = msg.content.filter((block) => block.type === 'tool_result');
        const textBlocks = msg.content.filter((block) => block.type === 'text');
        // const toolUseBlocks = msg.content.filter(block => block.type === 'tool_use');

        // CRITICAL: Tool messages must come BEFORE user text in OpenAI API
        for (const toolResult of toolResults) {
          result.push({
            role: 'tool',
            content:
              typeof toolResult.content === 'string'
                ? toolResult.content
                : JSON.stringify(toolResult.content),
          } as Message & { tool_call_id: string });
        }

        // Add text content as user/assistant message AFTER tool messages
        if (textBlocks.length > 0) {
          const textContent =
            textBlocks.length === 1
              ? textBlocks[0].text || ''
              : textBlocks.map((b) => b.text || '').join('\n');

          result.push({
            role: msg.role,
            content: textContent,
          });
        }

        // If no content at all, add empty message
        if (textBlocks.length === 0 && toolResults.length === 0) {
          result.push({
            role: msg.role,
            content: '',
          });
        }

        continue;
      }

      // Fallback: return message as-is
      result.push(msg);
    }

    return result;
  }

  /**
   * Transform Anthropic tools to OpenAI tools format
   */
  private transformTools(anthropicTools: AnthropicTool[]): OpenAITool[] {
    return anthropicTools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema || {},
      },
    }));
  }

  /**
   * Check if messages contain thinking control tags
   */
  private hasThinkingTags(messages: Message[]): boolean {
    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      const content = msg.content;
      if (typeof content !== 'string') continue;

      // Check for control tags
      if (/<Thinking:(On|Off)>/i.test(content) || /<Effort:(Low|Medium|High)>/i.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract thinking control tags from user messages
   */
  private extractThinkingControl(messages: Message[]): ThinkingConfig {
    const config: ThinkingConfig = {
      thinking: this.defaultThinking,
      effort: 'medium',
    };

    // Scan user messages for control tags
    for (const msg of messages) {
      if (msg.role !== 'user') continue;

      const content = msg.content;
      if (typeof content !== 'string') continue;

      // Check for <Thinking:On|Off>
      const thinkingMatch = content.match(/<Thinking:(On|Off)>/i);
      if (thinkingMatch) {
        config.thinking = thinkingMatch[1].toLowerCase() === 'on';
      }

      // Check for <Effort:Low|Medium|High>
      const effortMatch = content.match(/<Effort:(Low|Medium|High)>/i);
      if (effortMatch) {
        config.effort = effortMatch[1].toLowerCase();
      }
    }

    return config;
  }

  /**
   * Generate thinking signature for Claude Code UI
   */
  private generateThinkingSignature(thinking: string): ThinkingSignature {
    // Generate signature hash
    const hash = crypto.createHash('sha256').update(thinking).digest('hex').substring(0, 16);

    return {
      type: 'thinking_signature',
      hash: hash,
      length: thinking.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect Anthropic-style "think" keywords in user prompts
   */
  private detectThinkKeywords(
    messages: Message[]
  ): { thinking: boolean; effort: string; keyword: string } | null {
    if (!messages || messages.length === 0) return null;

    // Extract text from user messages
    const text = messages
      .filter((m) => m.role === 'user')
      .map((m) => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text || '')
            .join(' ');
        }
        return '';
      })
      .join(' ');

    // Priority: ultrathink > think harder > think hard > think
    if (/\bultrathink\b/i.test(text)) {
      return { thinking: true, effort: 'max', keyword: 'ultrathink' };
    }
    if (/\bthink\s+harder\b/i.test(text)) {
      return { thinking: true, effort: 'high', keyword: 'think harder' };
    }
    if (/\bthink\s+hard\b/i.test(text)) {
      return { thinking: true, effort: 'medium', keyword: 'think hard' };
    }
    if (/\bthink\b/i.test(text)) {
      return { thinking: true, effort: 'low', keyword: 'think' };
    }

    return null; // No keywords detected
  }

  /**
   * Inject reasoning parameters into OpenAI request
   */
  private injectReasoningParams(
    openaiRequest: OpenAIRequest,
    thinkingConfig: ThinkingConfig
  ): void {
    // Always enable sampling for temperature/top_p to work
    openaiRequest.do_sample = true;

    // Add thinking-specific parameters if enabled
    if (thinkingConfig.thinking) {
      openaiRequest.reasoning = true;
      openaiRequest.reasoning_effort = thinkingConfig.effort;
    }
  }

  /**
   * Map Anthropic model to GLM model
   */
  private mapModel(_anthropicModel: string): string {
    // Default to GLM-4.6 (latest and most capable)
    return 'GLM-4.6';
  }

  /**
   * Get max tokens for model
   */
  private getMaxTokens(model: string): number {
    return this.modelMaxTokens[model] || 128000;
  }

  /**
   * Map OpenAI stop reason to Anthropic stop reason
   */
  private mapStopReason(openaiReason: string): string {
    const mapping: Record<string, string> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
      content_filter: 'stop_sequence',
    };
    return mapping[openaiReason] || 'end_turn';
  }

  /**
   * Write debug log to file
   */
  private writeDebugLog(type: string, data: unknown): void {
    if (!this.debugLog) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
      const filename = `${timestamp}-${type}.json`;
      const filepath = path.join(this.debugLogDir, filename);

      // Ensure directory exists
      fs.mkdirSync(this.debugLogDir, { recursive: true });

      // Write file (pretty-printed)
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf8');

      if (this.verbose) {
        this.log(`Debug log written: ${filepath}`);
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[glmt-transformer] Failed to write debug log: ${err.message}`);
    }
  }

  /**
   * Validate transformed Anthropic response
   */
  private validateTransformation(anthropicResponse: AnthropicResponse): ValidationResult {
    const checks: Record<string, boolean> = {
      hasContent: Boolean(anthropicResponse.content && anthropicResponse.content.length > 0),
      hasThinking: anthropicResponse.content?.some((block) => block.type === 'thinking') || false,
      hasText: anthropicResponse.content?.some((block) => block.type === 'text') || false,
      validStructure:
        anthropicResponse.type === 'message' && anthropicResponse.role === 'assistant',
      hasUsage: Boolean(anthropicResponse.usage),
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    return { checks, passed, total, valid: passed === total };
  }

  /**
   * Transform OpenAI streaming delta to Anthropic events
   */
  transformDelta(openaiEvent: SSEEvent, accumulator: DeltaAccumulator): AnthropicSSEEvent[] {
    const events: AnthropicSSEEvent[] = [];

    // Debug logging for streaming deltas
    if (this.debugLog && openaiEvent.data) {
      this.writeDebugLog('delta-openai', openaiEvent.data);
    }

    // Handle [DONE] marker
    if (openaiEvent.event === 'done') {
      if (!accumulator.isFinalized()) {
        return this.finalizeDelta(accumulator);
      }
      return []; // Already finalized
    }

    // Usage update (appears in final chunk, may be before choice data)
    if (openaiEvent.data?.usage) {
      accumulator.updateUsage(openaiEvent.data.usage);

      // If we have both usage AND finish_reason, finalize immediately
      if (accumulator.getFinishReason()) {
        events.push(...this.finalizeDelta(accumulator));
        return events;
      }
    }

    const choice = openaiEvent.data?.choices?.[0];
    if (!choice) return events;

    const delta = choice.delta;
    if (!delta) return events;

    // Message start
    if (!accumulator.isMessageStarted()) {
      if (openaiEvent.data?.model) {
        accumulator.setModel(openaiEvent.data.model);
      }
      events.push(this.createMessageStartEvent(accumulator));
      accumulator.setMessageStarted(true);
    }

    // Role
    if (delta.role) {
      accumulator.setRole(delta.role);
    }

    // Reasoning content delta
    if (delta.reasoning_content) {
      const currentBlock = accumulator.getCurrentBlock();

      if (this.debugMode) {
        console.error(`[GLMT-DEBUG] Reasoning delta: ${delta.reasoning_content.length} chars`);
        console.error(
          `[GLMT-DEBUG] Current block: ${currentBlock?.type || 'none'}, index: ${currentBlock?.index ?? 'N/A'}`
        );
      }

      if (!currentBlock || currentBlock.type !== 'thinking') {
        // Start thinking block
        const block = accumulator.startBlock('thinking');
        events.push(this.createContentBlockStartEvent(block));

        if (this.debugMode) {
          console.error(`[GLMT-DEBUG] Started new thinking block ${block.index}`);
        }
      }

      accumulator.addDelta(delta.reasoning_content);
      const currentThinkingBlock = accumulator.getCurrentBlock();
      if (currentThinkingBlock) {
        events.push(this.createThinkingDeltaEvent(currentThinkingBlock, delta.reasoning_content));
      }
    }

    // Text content delta
    if (delta.content) {
      const currentBlock = accumulator.getCurrentBlock();

      // Close thinking block if transitioning from thinking to text
      if (currentBlock && currentBlock.type === 'thinking' && !currentBlock.stopped) {
        const signatureEvent = this.createSignatureDeltaEvent(currentBlock);
        if (signatureEvent) {
          events.push(signatureEvent);
        }
        events.push(this.createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      if (!accumulator.getCurrentBlock() || accumulator.getCurrentBlock()?.type !== 'text') {
        // Start text block
        const block = accumulator.startBlock('text');
        events.push(this.createContentBlockStartEvent(block));
      }

      accumulator.addDelta(delta.content);
      const currentTextBlock = accumulator.getCurrentBlock();
      if (currentTextBlock) {
        events.push(this.createTextDeltaEvent(currentTextBlock, delta.content));
      }
    }

    // Check for planning loop
    if (accumulator.checkForLoop()) {
      this.log(
        'WARNING: Planning loop detected - 3 consecutive thinking blocks with no tool calls'
      );
      this.log('Forcing early finalization to prevent unbounded planning');

      // Close current block if any
      const currentBlock = accumulator.getCurrentBlock();
      if (currentBlock && !currentBlock.stopped) {
        if (currentBlock.type === 'thinking') {
          const signatureEvent = this.createSignatureDeltaEvent(currentBlock);
          if (signatureEvent) {
            events.push(signatureEvent);
          }
        }
        events.push(this.createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      // Force finalization
      events.push(...this.finalizeDelta(accumulator));
      return events;
    }

    // Tool calls deltas
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      // Close current content block ONCE before processing any tool calls
      const currentBlock = accumulator.getCurrentBlock();
      if (currentBlock && !currentBlock.stopped) {
        if (currentBlock.type === 'thinking') {
          const signatureEvent = this.createSignatureDeltaEvent(currentBlock);
          if (signatureEvent) {
            events.push(signatureEvent);
          }
        }
        events.push(this.createContentBlockStopEvent(currentBlock));
        accumulator.stopCurrentBlock();
      }

      // Process each tool call delta
      for (const toolCallDelta of delta.tool_calls) {
        // Track tool call state
        const isNewToolCall = !accumulator.hasToolCall(toolCallDelta.index);
        accumulator.addToolCallDelta(toolCallDelta);

        // Emit tool use events (start + input_json deltas)
        if (isNewToolCall) {
          // Start new tool_use block in accumulator
          const block = accumulator.startBlock('tool_use');
          const toolCall = accumulator.getToolCall(toolCallDelta.index);

          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: block.index,
              content_block: {
                type: 'tool_use',
                id: toolCall?.id || `tool_${toolCallDelta.index}`,
                name: toolCall?.function?.name || '',
              },
            },
          });
        }

        // Emit input_json delta if arguments present
        if (toolCallDelta.function?.arguments) {
          const currentToolBlock = accumulator.getCurrentBlock();
          if (currentToolBlock && currentToolBlock.type === 'tool_use') {
            events.push({
              event: 'content_block_delta',
              data: {
                type: 'content_block_delta',
                index: currentToolBlock.index,
                delta: {
                  type: 'input_json_delta',
                  partial_json: toolCallDelta.function.arguments,
                },
              },
            });
          }
        }
      }
    }

    // Finish reason
    if (choice.finish_reason) {
      accumulator.setFinishReason(choice.finish_reason);

      // If we have both finish_reason AND usage, finalize immediately
      if (accumulator.hasUsageReceived()) {
        events.push(...this.finalizeDelta(accumulator));
      }
    }

    // Debug logging for generated events
    if (this.debugLog && events.length > 0) {
      this.writeDebugLog('delta-anthropic-events', {
        events,
        accumulator: accumulator.getSummary(),
      });
    }

    return events;
  }

  /**
   * Finalize streaming and generate closing events
   */
  finalizeDelta(accumulator: DeltaAccumulator): AnthropicSSEEvent[] {
    if (accumulator.isFinalized()) {
      return []; // Already finalized
    }

    const events: AnthropicSSEEvent[] = [];

    // Close current content block if any
    const currentBlock = accumulator.getCurrentBlock();
    if (currentBlock && !currentBlock.stopped) {
      if (currentBlock.type === 'thinking') {
        const signatureEvent = this.createSignatureDeltaEvent(currentBlock);
        if (signatureEvent) {
          events.push(signatureEvent);
        }
      }
      events.push(this.createContentBlockStopEvent(currentBlock));
      accumulator.stopCurrentBlock();
    }

    // Message delta (stop reason + usage)
    events.push({
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: {
          stop_reason: this.mapStopReason(accumulator.getFinishReason() || 'stop'),
        },
        usage: {
          input_tokens: accumulator.getInputTokens(),
          output_tokens: accumulator.getOutputTokens(),
        },
      },
    });

    // Message stop
    events.push({
      event: 'message_stop',
      data: {
        type: 'message_stop',
      },
    });

    accumulator.setFinalized(true);
    return events;
  }

  /**
   * Create message_start event
   */
  private createMessageStartEvent(accumulator: DeltaAccumulator): AnthropicSSEEvent {
    return {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: accumulator.getMessageId(),
          type: 'message',
          role: accumulator.getRole(),
          content: [],
          model: accumulator.getModel() || 'glm-4.6',
          stop_reason: null,
          usage: {
            input_tokens: accumulator.getInputTokens(),
            output_tokens: 0,
          },
        },
      },
    };
  }

  /**
   * Create content_block_start event
   */
  private createContentBlockStartEvent(block: AccumulatorBlock): AnthropicSSEEvent {
    return {
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: block.index,
        content_block: {
          type: block.type,
          [block.type]: '',
        },
      },
    };
  }

  /**
   * Create thinking_delta event
   */
  private createThinkingDeltaEvent(block: AccumulatorBlock, delta: string): AnthropicSSEEvent {
    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'thinking_delta',
          thinking: delta,
        },
      },
    };
  }

  /**
   * Create text_delta event
   */
  private createTextDeltaEvent(block: AccumulatorBlock, delta: string): AnthropicSSEEvent {
    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'text_delta',
          text: delta,
        },
      },
    };
  }

  /**
   * Create thinking signature delta event
   */
  private createSignatureDeltaEvent(block: AccumulatorBlock): AnthropicSSEEvent | null {
    // FIX: Guard against empty content (signature timing race)
    if (!block.content || block.content.length === 0) {
      if (this.verbose) {
        this.log(`WARNING: Skipping signature for empty thinking block ${block.index}`);
        this.log(
          `This indicates a race condition - signature requested before content accumulated`
        );
      }
      return null;
    }

    const signature = this.generateThinkingSignature(block.content);

    if (this.verbose) {
      this.log(`Generating signature for block ${block.index}: ${block.content.length} chars`);
    }

    return {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: block.index,
        delta: {
          type: 'thinking_signature_delta',
          signature: signature,
        },
      },
    };
  }

  /**
   * Create content_block_stop event
   */
  private createContentBlockStopEvent(block: AccumulatorBlock): AnthropicSSEEvent {
    return {
      event: 'content_block_stop',
      data: {
        type: 'content_block_stop',
        index: block.index,
      },
    };
  }

  /**
   * Log message if verbose
   */
  private log(message: string): void {
    if (this.verbose) {
      const timestamp = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      console.error(`[glmt-transformer] [${timestamp}] ${message}`);
    }
  }
}

export default GlmtTransformer;
