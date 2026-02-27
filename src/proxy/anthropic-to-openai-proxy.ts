/**
 * Anthropic-to-OpenAI Protocol Translation Proxy
 *
 * Translates Claude CLI's Anthropic Messages API requests into OpenAI Chat Completions API format.
 * Used in direct API key mode to bypass CLIProxy entirely.
 *
 * Request flow:
 *   Claude CLI (Anthropic format) → this proxy → OpenAI-compatible endpoint
 *
 * Response flow:
 *   OpenAI-compatible endpoint → this proxy (translates SSE) → Claude CLI (Anthropic format)
 *
 * Handles:
 *   - Path rewriting: /v1/messages → /v1/chat/completions
 *   - Auth translation: x-api-key → Authorization: Bearer
 *   - Request body: Anthropic messages/tools/system → OpenAI format
 *   - Streaming response: OpenAI SSE chunks → Anthropic SSE events
 *   - Non-streaming response: OpenAI completion → Anthropic message
 *   - Tool calls and tool results
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { URL } from 'url';

const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Shorten a tool name to fit within the upstream API's limit.
 * If the name exceeds MAX_TOOL_NAME_LENGTH, truncate and append a short hash for uniqueness.
 * Returns the original name if it's already short enough.
 */
function shortenToolName(name: string): string {
  if (name.length <= MAX_TOOL_NAME_LENGTH) return name;
  const hash = crypto.createHash('md5').update(name).digest('hex').slice(0, 8);
  // Reserve 1 char for underscore + 8 for hash = 9 chars
  return name.slice(0, MAX_TOOL_NAME_LENGTH - 9) + '_' + hash;
}

/** User agent matching Codex CLI for API compatibility */
const CODEX_USER_AGENT = 'codex_cli_rs/0.104.0 (Windows 10.0.19044; x86_64) WindowsTerminal';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnthropicToOpenAIProxyConfig {
  /** The user's OpenAI-compatible endpoint base URL (e.g., http://api.drlj.cn/openai) */
  targetBaseUrl: string;
  /** Bearer token for the target endpoint */
  apiKey: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Request timeout in ms */
  timeoutMs?: number;
  /**
   * Use OpenAI Responses API (default: true).
   * When true: uses /v1/responses with codex-specific params (prompt_cache_key, reasoning.summary, session headers).
   * When false: uses /v1/chat/completions only (generic OpenAI-compatible endpoints).
   */
  useResponsesApi?: boolean;
}

// Anthropic types (incoming from Claude CLI)
interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | AnthropicContentBlock[];
  source?: unknown;
}

interface AnthropicMessage {
  role: string;
  content: string | AnthropicContentBlock[];
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema?: unknown;
}

interface AnthropicToolChoice {
  type: string;
  name?: string;
  disable_parallel_tool_use?: boolean;
}

interface AnthropicRequest {
  model?: string;
  max_tokens?: number;
  system?: string | AnthropicContentBlock[];
  messages?: AnthropicMessage[];
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  reasoning?: { effort?: string };
  [key: string]: unknown;
}

// OpenAI types (outgoing to endpoint)
interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
}

interface OpenAIRequest {
  model?: string;
  max_tokens?: number;
  messages: OpenAIMessage[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: string | { type: string; function?: { name: string } };
  temperature?: number;
  top_p?: number;
  stop?: string[];
  reasoning?: { effort?: string };
  stream_options?: { include_usage?: boolean };
  [key: string]: unknown;
}

// OpenAI streaming chunk
interface OpenAIStreamChunk {
  id?: string;
  object?: string;
  model?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      role?: string;
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// ─── Request Translation ─────────────────────────────────────────────────────

function translateSystemPrompt(system: string | AnthropicContentBlock[] | undefined): string {
  if (!system) return '';
  if (typeof system === 'string') return system;
  // Array of content blocks - extract text
  return system
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('\n');
}

function translateMessages(messages: AnthropicMessage[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (!Array.isArray(msg.content)) {
      result.push({ role: msg.role, content: String(msg.content ?? '') });
      continue;
    }

    // Process content blocks
    if (msg.role === 'assistant') {
      // Assistant message may contain text + tool_use blocks
      const textParts: string[] = [];
      const toolCalls: OpenAIToolCall[] = [];

      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id || `call_${Math.random().toString(36).slice(2, 10)}`,
            type: 'function',
            function: {
              name: block.name || '',
              arguments:
                typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {}),
            },
          });
        }
      }

      const openaiMsg: OpenAIMessage = {
        role: 'assistant',
        content: textParts.length > 0 ? textParts.join('') : null,
      };
      if (toolCalls.length > 0) {
        openaiMsg.tool_calls = toolCalls;
      }
      result.push(openaiMsg);
    } else if (msg.role === 'user') {
      // User message may contain text, images, or tool_result blocks
      // Split tool_results into separate OpenAI tool messages
      const textParts: string[] = [];

      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        } else if (block.type === 'tool_result') {
          // Tool results become separate messages with role: "tool"
          let toolContent = '';
          if (typeof block.content === 'string') {
            toolContent = block.content;
          } else if (Array.isArray(block.content)) {
            toolContent = block.content
              .filter((b: AnthropicContentBlock) => b.type === 'text' && b.text)
              .map((b: AnthropicContentBlock) => b.text)
              .join('\n');
          }
          result.push({
            role: 'tool',
            content: toolContent,
            tool_call_id: block.tool_use_id || '',
          });
        }
        // Skip image/document blocks for now (not supported by most Chat Completions endpoints)
      }

      if (textParts.length > 0) {
        result.push({ role: 'user', content: textParts.join('') });
      }
    } else {
      // Other roles - just concatenate text
      const text = msg.content
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('');
      result.push({ role: msg.role, content: text || '' });
    }
  }

  return result;
}

function translateTools(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function translateToolChoice(
  choice: AnthropicToolChoice
): string | { type: string; function?: { name: string } } {
  switch (choice.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'tool':
      return { type: 'function', function: { name: choice.name || '' } };
    case 'none':
      return 'none';
    default:
      return 'auto';
  }
}

function translateRequestChat(anthropicReq: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];

  // Add system message if present
  const systemText = translateSystemPrompt(anthropicReq.system);
  if (systemText) {
    messages.push({ role: 'system', content: systemText });
  }

  // Translate conversation messages
  if (anthropicReq.messages) {
    messages.push(...translateMessages(anthropicReq.messages));
  }

  const openaiReq: OpenAIRequest = {
    model: anthropicReq.model,
    messages,
    stream: anthropicReq.stream,
  };

  if (anthropicReq.max_tokens !== undefined) {
    openaiReq.max_tokens = anthropicReq.max_tokens;
  }

  if (anthropicReq.temperature !== undefined) {
    openaiReq.temperature = anthropicReq.temperature;
  }

  if (anthropicReq.top_p !== undefined) {
    openaiReq.top_p = anthropicReq.top_p;
  }

  if (anthropicReq.stop_sequences) {
    openaiReq.stop = anthropicReq.stop_sequences;
  }

  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    openaiReq.tools = translateTools(anthropicReq.tools);
  }

  if (anthropicReq.tool_choice) {
    openaiReq.tool_choice = translateToolChoice(anthropicReq.tool_choice);
  }

  // Pass through reasoning effort (already in OpenAI format from CodexReasoningProxy)
  if (anthropicReq.reasoning) {
    openaiReq.reasoning = anthropicReq.reasoning;
  }

  // Request usage info in stream for token counting
  if (openaiReq.stream) {
    openaiReq.stream_options = { include_usage: true };
  }

  return openaiReq;
}

function toResponsesMessages(
  messages: OpenAIMessage[],
  toolNameMap?: Map<string, string>,
  hasChainedSession?: boolean
): ResponsesMessage[] {
  const out: ResponsesMessage[] = [];
  const toolCallIds = new Set<string>();

  // First pass: collect all tool call IDs in current input
  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls) {
      for (const tc of m.tool_calls) {
        if (tc.id) toolCallIds.add(tc.id);
      }
    }
  }

  for (const m of messages) {
    if (m.role === 'assistant') {
      // Assistant messages: add text content as message if present
      if (m.content) {
        out.push({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: m.content }],
        } as any);
      }
      // Add tool calls as function_call items
      if (m.tool_calls && m.tool_calls.length > 0) {
        for (const tc of m.tool_calls) {
          const originalName = tc.function.name;
          const shortName = shortenToolName(originalName);
          if (shortName !== originalName && toolNameMap) {
            toolNameMap.set(shortName, originalName);
          }
          out.push({
            type: 'function_call',
            call_id: tc.id,
            name: shortName,
            arguments: tc.function.arguments,
          } as any);
        }
      }
    } else if (m.role === 'tool') {
      // Tool results: use function_call_output format
      const callId = m.tool_call_id || '';
      if (callId && (toolCallIds.has(callId) || hasChainedSession)) {
        // In chained sessions, the matching function_call lives in the upstream server's
        // session state, not in the current input — so always include tool results.
        out.push({
          type: 'function_call_output',
          call_id: callId,
          output: m.content || '',
        } as any);
      } else if (callId) {
        console.warn(`[cliproxy] Skipping tool result with unmatched call_id: ${callId}`);
      }
    } else {
      // User/system/developer messages: use simplified format
      const textContent = m.content ?? '';
      out.push({ role: m.role, content: textContent } as any);
    }
  }

  return out;
}

function translateChatToResponses(
  chat: OpenAIRequest,
  previousResponseId?: string | null,
  toolNameMap?: Map<string, string>
): ResponsesRequest {
  // Extract system messages → instructions field (enables prompt caching)
  const systemParts: string[] = [];
  const nonSystemMessages: OpenAIMessage[] = [];
  for (const m of chat.messages) {
    if (m.role === 'system' && m.content) {
      systemParts.push(m.content);
    } else {
      nonSystemMessages.push(m);
    }
  }

  // When chaining with previous_response_id, only send new messages (after last assistant turn)
  let inputMessages = nonSystemMessages;
  if (previousResponseId) {
    let lastAssistantIdx = -1;
    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      if (nonSystemMessages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx >= 0) {
      inputMessages = nonSystemMessages.slice(lastAssistantIdx + 1);
    }
  }

  const req: ResponsesRequest = {
    model: chat.model,
    input: toResponsesMessages(inputMessages, toolNameMap, !!previousResponseId),
    stream: chat.stream,
    store: false,
    prompt_cache_key: 'ccs-codex-stable',
    reasoning: {
      ...(typeof chat.reasoning === 'object' ? chat.reasoning : {}),
      effort: chat.reasoning?.effort ?? 'xhigh',
      summary: 'auto',
    },
    include: ['reasoning.encrypted_content'],
  } as any;
  if (previousResponseId) {
    (req as any).previous_response_id = previousResponseId;
    // Server already has instructions + tools from the chain, skip to save tokens
  } else {
    // First request: send instructions and tools
    if (systemParts.length > 0) {
      (req as any).instructions = systemParts.join('\n');
    }
    if (chat.tools) {
      req.tools = chat.tools.map((t: OpenAITool) => {
        const originalName = t.function.name;
        const shortName = shortenToolName(originalName);
        if (shortName !== originalName && toolNameMap) {
          toolNameMap.set(shortName, originalName);
        }
        return {
          type: 'function' as const,
          name: shortName,
          description: t.function.description,
          parameters: t.function.parameters,
        };
      });
    }
    const responsesToolChoice = translateToolChoiceForResponses(chat.tool_choice, toolNameMap);
    if (responsesToolChoice !== undefined) req.tool_choice = responsesToolChoice as any;
  }
  return req;
}

function translateToolChoiceForResponses(
  toolChoice: OpenAIRequest['tool_choice'],
  toolNameMap?: Map<string, string>
): string | { type: 'function'; name: string } | undefined {
  if (!toolChoice) return undefined;
  if (typeof toolChoice === 'string') return toolChoice;

  if (toolChoice.type === 'function') {
    const name = toolChoice.function?.name?.trim();
    if (!name) return 'auto';
    const shortName = shortenToolName(name);
    if (shortName !== name && toolNameMap) {
      toolNameMap.set(shortName, name);
    }
    return { type: 'function', name: shortName };
  }

  return 'auto';
}

function consumeSSEEvents(buffer: string): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() || '';
  return {
    events: parts.filter((evt) => evt.trim().length > 0),
    rest,
  };
}

function extractSSEDataPayload(event: string): string | null {
  const dataLines: string[] = [];
  for (const rawLine of event.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.startsWith('data:')) continue;
    dataLines.push(line.slice(5).trimStart());
  }

  if (dataLines.length === 0) return null;
  return dataLines.join('\n');
}

// ─── Streaming Response Translation ──────────────────────────────────────────

/** State tracker for translating OpenAI streaming chunks into Anthropic SSE events */
class StreamingResponseTranslator {
  private messageId: string;
  private model: string;
  private contentBlockIndex = 0;
  private inTextBlock = false;
  private inThinkingBlock = false;
  private inToolCallBlocks = new Map<number, { id: string; name: string; started: boolean }>();
  private inputTokens = 0;
  private outputTokens = 0;
  private headersSent = false;
  private toolNameMap: Map<string, string>;

  constructor(model: string, toolNameMap?: Map<string, string>) {
    this.messageId = `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.model = model;
    this.toolNameMap = toolNameMap || new Map();
  }

  private sse(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  /** Produce the initial message_start event */
  emitMessageStart(): string {
    return this.sse('message_start', {
      type: 'message_start',
      message: {
        id: this.messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: this.model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: this.inputTokens, output_tokens: 0 },
      },
    });
  }

  /** Emit a thinking content block start */
  emitThinkingStart(): string {
    let events = '';
    if (!this.headersSent) {
      this.headersSent = true;
      events += this.emitMessageStart();
    }
    events += this.sse('content_block_start', {
      type: 'content_block_start',
      index: this.contentBlockIndex,
      content_block: { type: 'thinking', thinking: '' },
    });
    this.inThinkingBlock = true;
    return events;
  }

  /** Emit a thinking content delta */
  emitThinkingDelta(text: string): string {
    if (!text) return '';
    return this.sse('content_block_delta', {
      type: 'content_block_delta',
      index: this.contentBlockIndex,
      delta: { type: 'thinking_delta', thinking: text },
    });
  }

  /** Emit thinking block stop */
  emitThinkingStop(): string {
    if (!this.inThinkingBlock) return '';
    const events = this.sse('content_block_stop', {
      type: 'content_block_stop',
      index: this.contentBlockIndex,
    });
    this.contentBlockIndex++;
    this.inThinkingBlock = false;
    return events;
  }

  /** Translate a single OpenAI chunk to zero or more Anthropic SSE events */
  translateChunk(chunk: OpenAIStreamChunk): string {
    let events = '';

    // Track usage
    if (chunk.usage) {
      if (chunk.usage.prompt_tokens) this.inputTokens = chunk.usage.prompt_tokens;
      if (chunk.usage.completion_tokens) this.outputTokens = chunk.usage.completion_tokens;
    }

    if (!chunk.choices || chunk.choices.length === 0) return events;
    const choice = chunk.choices[0];
    if (!choice) return events;
    const delta = choice.delta;

    // Emit message_start on first content
    if (!this.headersSent && delta) {
      this.headersSent = true;
      events += this.emitMessageStart();
    }

    // Handle reasoning content (OpenAI Chat Completions returns this for reasoning models)
    if (delta?.reasoning_content !== undefined && delta.reasoning_content !== null) {
      if (!this.inThinkingBlock) {
        events += this.emitThinkingStart();
      }
      if (delta.reasoning_content) {
        events += this.emitThinkingDelta(delta.reasoning_content);
      }
    }

    // Close thinking block when text content starts
    if (delta?.content !== undefined && delta.content !== null && this.inThinkingBlock) {
      events += this.emitThinkingStop();
    }

    // Handle text content
    if (delta?.content !== undefined && delta.content !== null) {
      if (!this.inTextBlock) {
        // Start a new text content block
        events += this.sse('content_block_start', {
          type: 'content_block_start',
          index: this.contentBlockIndex,
          content_block: { type: 'text', text: '' },
        });
        this.inTextBlock = true;
      }
      if (delta.content) {
        events += this.sse('content_block_delta', {
          type: 'content_block_delta',
          index: this.contentBlockIndex,
          delta: { type: 'text_delta', text: delta.content },
        });
      }
    }

    // Handle tool calls
    if (delta?.tool_calls) {
      // Close text block if open
      if (this.inTextBlock) {
        events += this.sse('content_block_stop', {
          type: 'content_block_stop',
          index: this.contentBlockIndex,
        });
        this.contentBlockIndex++;
        this.inTextBlock = false;
      }

      for (const tc of delta.tool_calls) {
        const tcIndex = tc.index ?? 0;
        let tracked = this.inToolCallBlocks.get(tcIndex);

        // New tool call
        if (tc.id && tc.function?.name) {
          const resolvedName = this.toolNameMap.get(tc.function.name) || tc.function.name;
          tracked = { id: tc.id, name: resolvedName, started: false };
          this.inToolCallBlocks.set(tcIndex, tracked);
        }

        if (!tracked) continue;

        // Emit content_block_start for new tool call
        if (!tracked.started) {
          events += this.sse('content_block_start', {
            type: 'content_block_start',
            index: this.contentBlockIndex,
            content_block: { type: 'tool_use', id: tracked.id, name: tracked.name, input: {} },
          });
          tracked.started = true;
          this.contentBlockIndex++;
        }

        // Emit argument deltas
        if (tc.function?.arguments) {
          // Use contentBlockIndex - 1 since we incremented after block start
          events += this.sse('content_block_delta', {
            type: 'content_block_delta',
            index: this.contentBlockIndex - 1,
            delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
          });
        }
      }
    }

    // Handle finish
    if (choice.finish_reason) {
      // Close any open blocks
      if (this.inTextBlock) {
        events += this.sse('content_block_stop', {
          type: 'content_block_stop',
          index: this.contentBlockIndex,
        });
        this.contentBlockIndex++;
        this.inTextBlock = false;
      }

      // Close thinking block if still open
      if (this.inThinkingBlock) {
        events += this.emitThinkingStop();
      }

      // Close open tool call blocks
      let tcBlockIdx = this.contentBlockIndex - this.inToolCallBlocks.size;
      for (const [, tracked] of this.inToolCallBlocks) {
        if (tracked.started) {
          events += this.sse('content_block_stop', {
            type: 'content_block_stop',
            index: tcBlockIdx,
          });
        }
        tcBlockIdx++;
      }
      this.inToolCallBlocks.clear();

      // Map finish reason
      let stopReason: string;
      switch (choice.finish_reason) {
        case 'tool_calls':
          stopReason = 'tool_use';
          break;
        case 'length':
          stopReason = 'max_tokens';
          break;
        default:
          stopReason = 'end_turn';
      }

      events += this.sse('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: this.outputTokens },
      });

      events += this.sse('message_stop', { type: 'message_stop' });
    }

    return events;
  }

  /** Handle case where no chunks were received or stream ended without finish_reason */
  emitFinalIfNeeded(): string {
    let events = '';

    if (!this.headersSent) {
      events += this.emitMessageStart();
    }

    // Close thinking block if still open
    if (this.inThinkingBlock) {
      events += this.emitThinkingStop();
    }

    if (this.inTextBlock) {
      events += this.sse('content_block_stop', {
        type: 'content_block_stop',
        index: this.contentBlockIndex,
      });
    }

    let tcBlockIdx = this.contentBlockIndex - this.inToolCallBlocks.size;
    for (const [, tracked] of this.inToolCallBlocks) {
      if (tracked.started) {
        events += this.sse('content_block_stop', {
          type: 'content_block_stop',
          index: tcBlockIdx,
        });
      }
      tcBlockIdx++;
    }

    events += this.sse('message_delta', {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: this.outputTokens },
    });

    events += this.sse('message_stop', { type: 'message_stop' });

    return events;
  }
}

// ─── Responses API Types ────────────────────────────────────────────────────

interface ResponsesMessageContentText {
  type: 'input_text' | 'output_text';
  text: string;
}

interface ResponsesMessageContentImage {
  type: 'input_image';
  source: {
    type: 'url' | 'base64';
    url?: string;
    media_type?: string;
    data?: string;
  };
}

interface ResponsesMessageContentFunctionCall {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
}

interface ResponsesMessageContentFunctionCallOutput {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

type ResponsesMessageContent =
  | ResponsesMessageContentText
  | ResponsesMessageContentImage
  | ResponsesMessageContentFunctionCall
  | ResponsesMessageContentFunctionCallOutput;

interface ResponsesMessage {
  role: string;
  content: ResponsesMessageContent[];
}

interface ResponsesTool {
  type: 'function';
  name: string;
  description?: string;
  parameters?: unknown;
}

interface ResponsesRequest {
  model?: string;
  input: ResponsesMessage[] | string;
  stream?: boolean;
  tools?: ResponsesTool[];
  tool_choice?: string | { type: string; function?: { name: string } };
  temperature?: number;
  top_p?: number;
  stop?: string[];
  reasoning?: { effort?: string };
}

function normalizeModelCreatedAt(created: unknown): string {
  if (typeof created === 'number' && Number.isFinite(created) && created > 0) {
    return new Date(created * 1000).toISOString();
  }
  return new Date().toISOString();
}

function normalizeModelsPayloadForAnthropic(rawPayload: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return rawPayload;
  }

  if (!parsed || typeof parsed !== 'object') {
    return rawPayload;
  }

  const record = parsed as Record<string, unknown>;
  const data = record.data;

  if (Array.isArray(data)) {
    const alreadyAnthropic = data.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const m = item as Record<string, unknown>;
      return typeof m.id === 'string' && typeof m.created_at === 'string';
    });

    if (alreadyAnthropic) {
      return rawPayload;
    }

    const models = data
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const m = item as Record<string, unknown>;
        const id = typeof m.id === 'string' ? m.id : '';
        if (!id) return null;
        return {
          type: 'model',
          id,
          display_name: id,
          created_at: normalizeModelCreatedAt(m.created),
        };
      })
      .filter(
        (item): item is { type: string; id: string; display_name: string; created_at: string } =>
          Boolean(item)
      );

    return JSON.stringify({
      data: models,
      first_id: models.length > 0 ? models[0].id : null,
      last_id: models.length > 0 ? models[models.length - 1].id : null,
      has_more: false,
    });
  }

  if (typeof record.id === 'string') {
    const id = record.id;
    return JSON.stringify({
      type: 'model',
      id,
      display_name: id,
      created_at: normalizeModelCreatedAt(record.created),
    });
  }

  return rawPayload;
}

// ─── Proxy Server ────────────────────────────────────────────────────────────

export class AnthropicToOpenAIProxy {
  private server: http.Server | null = null;
  private port: number | null = null;
  private readonly config: Required<
    Pick<
      AnthropicToOpenAIProxyConfig,
      'targetBaseUrl' | 'apiKey' | 'verbose' | 'timeoutMs' | 'useResponsesApi'
    >
  >;
  private readonly httpAgent: http.Agent;
  private readonly httpsAgent: https.Agent;
  private readonly maxNetworkRetries = 2;
  /** Track last Responses API response ID for conversation chaining */
  private lastResponseId: string | null = null;
  /** Maps shortened tool names (sent upstream) → original tool names (used by Claude CLI) */
  private toolNameMap: Map<string, string> = new Map();

  /**
   * Detect context window overflow errors from upstream.
   */
  private isContextWindowError(body: string): boolean {
    const lower = body.toLowerCase();
    return (
      lower.includes('exceeds the context window') ||
      lower.includes('context_length_exceeded') ||
      lower.includes('prompt is too long') ||
      lower.includes('maximum context length') ||
      lower.includes('input is too long')
    );
  }

  /**
   * Trim conversation messages to fit a smaller upstream context window.
   * Uses a progressive strategy to preserve conversation quality:
   *   Pass 1: Strip tool results from older messages (keep recent N turns intact)
   *   Pass 2: Remove entire old tool call/result pairs
   *   Pass 3: Drop oldest non-system messages (last resort)
   * Also removes orphaned tool results whose tool_call is no longer present.
   */
  private trimMessages(messages: OpenAIMessage[]): boolean {
    const originalCount = messages.length;
    const systemMsgs = messages.filter((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    if (nonSystem.length <= 4) return false; // too few to trim

    // How many recent messages to protect from trimming
    const protectedTail = Math.min(10, Math.ceil(nonSystem.length * 0.3));
    const olderMessages = nonSystem.slice(0, nonSystem.length - protectedTail);
    const recentMessages = nonSystem.slice(nonSystem.length - protectedTail);

    // Pass 1: Truncate tool result content in older messages (replace with summary)
    let trimmed = false;
    for (const m of olderMessages) {
      if (m.role === 'tool' && m.content && m.content.length > 200) {
        m.content = '[trimmed tool output]';
        trimmed = true;
      }
      // Also truncate large assistant content in older turns
      if (m.role === 'assistant' && typeof m.content === 'string' && m.content.length > 500) {
        m.content = m.content.slice(0, 200) + '\n...[trimmed]';
        trimmed = true;
      }
    }

    // Pass 2: Remove old tool call/result pairs entirely (keep the conversation flow)
    let filtered = olderMessages.filter((m) => {
      if (m.role === 'tool') return false; // drop old tool results
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        // Keep the assistant message but strip tool_calls
        delete m.tool_calls;
        if (!m.content) m.content = '[tool calls removed]';
        trimmed = true;
      }
      return true;
    });

    // Pass 3: If still too many, keep only the last few older messages
    if (filtered.length > 10) {
      filtered = filtered.slice(filtered.length - 6);
      trimmed = true;
    }

    if (!trimmed) return false;

    // Reassemble: system + trimmed older + protected recent
    const result = [...systemMsgs, ...filtered, ...recentMessages];

    // Clean up orphaned tool results in recent messages
    const presentCallIds = new Set<string>();
    for (const m of result) {
      if (m.role === 'assistant' && m.tool_calls) {
        for (const tc of m.tool_calls) presentCallIds.add(tc.id);
      }
    }
    const cleaned = result.filter(
      (m) => m.role !== 'tool' || (m.tool_call_id && presentCallIds.has(m.tool_call_id))
    );

    this.log(
      `[context-trim] Trimmed messages from ${originalCount} to ${cleaned.length} (removed ${originalCount - cleaned.length} messages, truncated tool outputs)`
    );
    // Mutate in place
    messages.length = 0;
    messages.push(...cleaned);
    return true;
  }

  constructor(config: AnthropicToOpenAIProxyConfig) {
    // Normalize base URL: strip trailing slashes and /v1 suffix
    // We append /v1/chat/completions or /v1/responses ourselves
    let baseUrl = config.targetBaseUrl.replace(/\/+$/, '');
    baseUrl = baseUrl.replace(/\/v1$/i, '');
    this.config = {
      targetBaseUrl: baseUrl,
      apiKey: config.apiKey,
      verbose: config.verbose ?? false,
      timeoutMs: config.timeoutMs ?? 120000,
      useResponsesApi: config.useResponsesApi ?? true,
    };

    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
      maxSockets: 64,
      maxFreeSockets: 16,
    });
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
      maxSockets: 64,
      maxFreeSockets: 16,
    });
  }

  private readonly debugLogPath = path.join(os.tmpdir(), 'ccs-proxy-debug.log');

  private log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try {
      fs.appendFileSync(this.debugLogPath, line);
    } catch {
      /* ignore */
    }
    if (this.config.verbose) {
      console.error(`[anthropic-to-openai] ${msg}`);
    }
  }

  private isRetryableNetworkError(error: Error): boolean {
    const err = error as NodeJS.ErrnoException;
    const code = String(err.code || '');

    if (
      [
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ECONNREFUSED',
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ENETUNREACH',
      ].includes(code)
    ) {
      return true;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('socket hang up') ||
      message.includes('network socket disconnected') ||
      message.includes('client network socket disconnected')
    );
  }

  private isRetryableStatusCode(statusCode: number): boolean {
    return [408, 409, 425, 429, 500, 502, 503, 504].includes(statusCode);
  }

  private getRetryDelayMs(attempt: number, error?: Error): number {
    const code = String((error as NodeJS.ErrnoException | undefined)?.code || '');
    const baseMs = code === 'ECONNRESET' ? 3000 : 1000;
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(baseMs * Math.pow(2, Math.max(0, attempt - 1)) + jitter, 15000);
  }

  async start(): Promise<number> {
    if (this.server) return this.port ?? 0;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address();
        this.port = typeof addr === 'object' && addr ? addr.port : 0;
        this.log(
          `Proxy started on port ${this.port}, target=${this.config.targetBaseUrl}, responses=${this.config.useResponsesApi}`
        );
        console.error(`[ccs-proxy] Debug log: ${this.debugLogPath}`);
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = null;
    }

    this.httpAgent.destroy();
    this.httpsAgent.destroy();

    // Clean up debug log file
    try {
      fs.unlinkSync(this.debugLogPath);
    } catch {
      /* ignore if already removed */
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const maxSize = 10 * 1024 * 1024;
      let total = 0;

      req.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxSize) {
          req.destroy();
          reject(new Error('Request body too large'));
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  private async handleModelsRequest(
    requestPath: string,
    clientRes: http.ServerResponse
  ): Promise<void> {
    return new Promise((resolve) => {
      const targetUrl = new URL(`${this.config.targetBaseUrl}${requestPath}`);
      const requestFn = targetUrl.protocol === 'https:' ? https.request : http.request;

      const upstreamReq = requestFn(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port,
          path: targetUrl.pathname + targetUrl.search,
          method: 'GET',
          timeout: this.config.timeoutMs,
          agent: targetUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent,
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: 'application/json',
            'User-Agent': CODEX_USER_AGENT,
          },
        },
        (upstreamRes) => {
          const chunks: Buffer[] = [];
          upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          upstreamRes.on('end', () => {
            const statusCode = upstreamRes.statusCode || 502;
            const rawBody = Buffer.concat(chunks).toString('utf8');
            const normalizedBody =
              statusCode < 400 ? normalizeModelsPayloadForAnthropic(rawBody) : rawBody;

            if (!clientRes.headersSent) {
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
            }
            clientRes.end(
              normalizedBody ||
                JSON.stringify({
                  type: 'error',
                  error: {
                    type: 'api_error',
                    message: `Upstream models request failed: ${statusCode}`,
                  },
                })
            );
            resolve();
          });
          upstreamRes.on('error', (err) => {
            if (!clientRes.headersSent) {
              clientRes.writeHead(502, { 'Content-Type': 'application/json' });
            }
            clientRes.end(
              JSON.stringify({
                type: 'error',
                error: { type: 'api_error', message: err.message },
              })
            );
            resolve();
          });
        }
      );

      upstreamReq.on('timeout', () => {
        upstreamReq.destroy(new Error('Upstream models request timeout'));
      });
      upstreamReq.on('error', (err) => {
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        }
        clientRes.end(
          JSON.stringify({
            type: 'error',
            error: { type: 'api_error', message: err.message },
          })
        );
        resolve();
      });

      upstreamReq.end();
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method || 'GET';
    let requestPath = req.url || '/';

    // Strip /api/provider/{provider} prefix if present
    // Claude CLI sends to /api/provider/codex/v1/messages, we need /v1/messages
    const providerPrefixMatch = requestPath.match(/^\/api\/provider\/[^/]+(.*)$/);
    if (providerPrefixMatch) {
      requestPath = providerPrefixMatch[1] || '/';
    }

    this.log(`${method} ${req.url} → path=${requestPath}`);

    // Handle count_tokens endpoint - return a fake estimate since Responses API has no equivalent
    if (method === 'POST' && requestPath.includes('/count_tokens')) {
      this.log('count_tokens request - returning estimate');
      try {
        const rawBody = await this.readBody(req);
        const body = rawBody.length ? JSON.parse(rawBody) : {};
        // Rough estimate: ~4 chars per token
        const textLen = JSON.stringify(body.messages || body).length;
        const estimate = Math.ceil(textLen / 4);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ input_tokens: estimate }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ input_tokens: 1000 }));
      }
      return;
    }

    if (method === 'GET' && requestPath.startsWith('/v1/models')) {
      await this.handleModelsRequest(requestPath, res);
      return;
    }

    // Only handle POST /v1/messages (the Anthropic Messages API endpoint)
    if (method !== 'POST' || !requestPath.startsWith('/v1/messages')) {
      // For other paths, return a simple response
      if (method === 'GET' && requestPath === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', proxy: 'anthropic-to-openai' }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unsupported: ${method} ${requestPath}` }));
      return;
    }

    try {
      const rawBody = await this.readBody(req);
      let anthropicReq: AnthropicRequest;
      try {
        anthropicReq = rawBody.length ? JSON.parse(rawBody) : {};
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Translate request
      const openaiReq = translateRequestChat(anthropicReq);
      const model = anthropicReq.model || 'unknown';
      this.log(
        `Translated request: model=${model}, stream=${openaiReq.stream}, messages=${openaiReq.messages.length}`
      );

      // Build target base URL (without endpoint path)
      const targetBase = this.config.targetBaseUrl;

      // Force streaming for upstream API (both Responses and Chat Completions)
      const wantStream = !!openaiReq.stream;
      openaiReq.stream = true;
      if (wantStream) {
        await this.handleStreaming(req, res, targetBase, openaiReq, model);
      } else {
        // Non-streaming: collect streaming response, return as JSON
        await this.handleNonStreamingViaStream(req, res, targetBase, openaiReq, model);
      }
    } catch (error) {
      const err = error as Error;
      this.log(`Error: ${err.message}`);

      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            type: 'error',
            error: { type: 'api_error', message: err.message },
          })
        );
        return;
      }

      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  private async handleStreaming(
    _req: http.IncomingMessage,
    clientRes: http.ServerResponse,
    targetBase: string,
    openaiReqChat: OpenAIRequest,
    model: string
  ): Promise<void> {
    let retried401 = false;
    let retriedWithoutResponseId = false;
    let retriedWithTrimmedContext = false;
    const networkRetryCount: Record<'chat' | 'responses', number> = { chat: 0, responses: 0 };

    const attempt = (mode: 'chat' | 'responses'): Promise<void> => {
      return new Promise((resolveAttempt, rejectAttempt) => {
        const scheduleNetworkRetry = (err: Error, source: 'request' | 'response'): boolean => {
          if (
            !this.isRetryableNetworkError(err) ||
            clientRes.headersSent ||
            clientRes.writableEnded
          ) {
            return false;
          }

          const next = networkRetryCount[mode] + 1;
          if (next > this.maxNetworkRetries) {
            return false;
          }

          networkRetryCount[mode] = next;
          const delay = this.getRetryDelayMs(next, err);
          const seconds = Math.max(1, Math.round(delay / 1000));
          const errCode = String((err as NodeJS.ErrnoException).code || '');
          if (errCode === 'ECONNRESET') {
            this.log(
              `Connection reset by server [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}] (${source}, ${mode})`
            );
          } else {
            this.log(
              `Transient network error (${source}, ${mode}): ${err.message} [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}]`
            );
          }
          setTimeout(() => {
            attempt(mode).then(resolveAttempt).catch(rejectAttempt);
          }, delay);
          return true;
        };

        const targetUrl = new URL(
          `${targetBase}${mode === 'chat' ? '/v1/chat/completions' : '/v1/responses'}`
        );
        const body =
          mode === 'chat'
            ? openaiReqChat
            : translateChatToResponses(
                JSON.parse(JSON.stringify({ ...openaiReqChat, stream: true })) as any,
                this.lastResponseId,
                this.toolNameMap
              );
        const bodyString = JSON.stringify(body);
        this.log(`[DEBUG] Upstream ${mode} URL: ${targetUrl.href}`);
        this.log(`[DEBUG] Upstream ${mode} request body (${bodyString.length}B):\n${bodyString}`);
        const requestFn = targetUrl.protocol === 'https:' ? https.request : http.request;
        // Build headers: include codex session headers only when using Responses API
        const upstreamHeaders: Record<string, string | number> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'text/event-stream',
          'User-Agent': CODEX_USER_AGENT,
        };
        if (this.config.useResponsesApi) {
          upstreamHeaders['x-session-id'] = 'ccs-codex-stable';
          upstreamHeaders['conversation_id'] = 'ccs-codex-stable';
          upstreamHeaders['session_id'] = 'ccs-codex-stable';
        }

        const upstreamReq = requestFn(
          {
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname + targetUrl.search,
            method: 'POST',
            timeout: this.config.timeoutMs,
            agent: targetUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent,
            headers: upstreamHeaders,
          },
          (upstreamRes) => {
            const statusCode = upstreamRes.statusCode || 200;

            if (statusCode >= 400) {
              const chunks: Buffer[] = [];
              upstreamRes.on('data', (c: Buffer) => chunks.push(c));
              upstreamRes.on('end', () => {
                const bodyErr = Buffer.concat(chunks).toString('utf8');
                this.log(`Upstream ${mode} error ${statusCode}: ${bodyErr.slice(0, 1000)}`);
                // Try fallback: chat→responses (only if Responses API is enabled)
                if (mode === 'chat' && this.config.useResponsesApi) {
                  attempt('responses').then(resolveAttempt).catch(rejectAttempt);
                  return;
                }
                // Auto-retry once on 401 (backend intermittently returns token_revoked)
                if (statusCode === 401 && !retried401) {
                  retried401 = true;
                  this.log('401 received, retrying once...');
                  setTimeout(() => {
                    attempt(mode).then(resolveAttempt).catch(rejectAttempt);
                  }, 500);
                  return;
                }

                // If using previous_response_id and got an error, clear it and retry with full request
                if (
                  mode === 'responses' &&
                  this.lastResponseId &&
                  !retriedWithoutResponseId &&
                  !clientRes.headersSent
                ) {
                  retriedWithoutResponseId = true;
                  this.log(
                    `Clearing stale previous_response_id (${this.lastResponseId}) due to ${statusCode}, retrying with full request`
                  );
                  this.lastResponseId = null;
                  networkRetryCount[mode] = 0; // Reset retry count for fresh attempt
                  attempt(mode).then(resolveAttempt).catch(rejectAttempt);
                  return;
                }

                // Context window overflow: trim old messages and retry once
                if (
                  this.isContextWindowError(bodyErr) &&
                  !retriedWithTrimmedContext &&
                  !clientRes.headersSent
                ) {
                  retriedWithTrimmedContext = true;
                  this.lastResponseId = null; // chain is invalid after trimming
                  if (this.trimMessages(openaiReqChat.messages)) {
                    networkRetryCount[mode] = 0;
                    attempt(mode).then(resolveAttempt).catch(rejectAttempt);
                    return;
                  }
                }

                if (this.isRetryableStatusCode(statusCode) && !clientRes.headersSent) {
                  const next = networkRetryCount[mode] + 1;
                  if (next <= this.maxNetworkRetries) {
                    networkRetryCount[mode] = next;
                    const delay = this.getRetryDelayMs(next);
                    const seconds = Math.max(1, Math.round(delay / 1000));
                    this.log(
                      `Transient upstream status ${statusCode} [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}] (${mode})`
                    );
                    setTimeout(() => {
                      attempt(mode).then(resolveAttempt).catch(rejectAttempt);
                    }, delay);
                    return;
                  }
                }
                // No fallback left: return error
                if (!clientRes.headersSent) {
                  clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
                }
                try {
                  const parsed = JSON.parse(bodyErr);
                  clientRes.end(
                    JSON.stringify({
                      type: 'error',
                      error: {
                        type: 'api_error',
                        message: parsed?.error?.message || bodyErr.slice(0, 500),
                      },
                    })
                  );
                } catch {
                  clientRes.end(
                    JSON.stringify({
                      type: 'error',
                      error: { type: 'api_error', message: bodyErr.slice(0, 500) },
                    })
                  );
                }
                resolveAttempt();
              });
              return;
            }

            // Set up Anthropic SSE response
            clientRes.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            });

            const translator = new StreamingResponseTranslator(model, this.toolNameMap);
            let buffer = '';
            let hasFinished = false;
            const activeToolCalls = new Map<number, { id: string; name: string }>();
            let refusalStarted = false;

            upstreamRes.on('data', (chunk: Buffer) => {
              buffer += chunk.toString('utf8');

              const parsedEvents = consumeSSEEvents(buffer);
              buffer = parsedEvents.rest;

              for (const event of parsedEvents.events) {
                if (hasFinished) continue;

                const jsonStr = extractSSEDataPayload(event);
                if (!jsonStr) continue;

                if (jsonStr.trim() === '[DONE]') {
                  if (!hasFinished) {
                    const final = translator.emitFinalIfNeeded();
                    if (final) clientRes.write(final);
                    hasFinished = true;
                  }
                  continue;
                }

                try {
                  // Try Chat Completions chunk first
                  const parsed = JSON.parse(jsonStr);
                  if (parsed && parsed.type) {
                    // Responses API event
                    const evtType: string = parsed.type;
                    if (evtType === 'keepalive') {
                      // Keepalive event: silently ignore (connection heartbeat)
                    } else if (
                      evtType === 'response.created' ||
                      evtType === 'response.in_progress'
                    ) {
                      // Response lifecycle events: silently ignore (informational only)
                      // These indicate the response has started/is processing
                    } else if (
                      evtType.endsWith('.output_text.delta') &&
                      typeof parsed.delta === 'string'
                    ) {
                      // Start block if needed, then stream text
                      const start = translator.translateChunk({
                        choices: [{ delta: { content: '' } }],
                      } as any);
                      const textDelta = translator.translateChunk({
                        choices: [{ delta: { content: parsed.delta } }],
                      } as any);
                      if (start) clientRes.write(start);
                      if (textDelta) clientRes.write(textDelta);
                    } else if (evtType === 'response.output_text.done') {
                      // output_text.done is informational; block close is handled by finish_reason/completed.
                    } else if (evtType === 'response.output_item.added') {
                      // Output item added: handle function_call, ignore message type (content comes via output_text.delta)
                      if (parsed.item?.type === 'function_call') {
                        // Tool call start: emit as Anthropic tool_use via fake chunk
                        const tcId = parsed.item.call_id || parsed.item.id || `call_${Date.now()}`;
                        const tcName =
                          this.toolNameMap.get(parsed.item.name || '') || parsed.item.name || '';
                        const outputIndex = parsed.output_index ?? 0;
                        activeToolCalls.set(outputIndex, { id: tcId, name: tcName });
                        const events = translator.translateChunk({
                          choices: [
                            {
                              delta: {
                                tool_calls: [
                                  {
                                    index: outputIndex,
                                    id: tcId,
                                    function: { name: tcName, arguments: '' },
                                  },
                                ],
                              },
                            },
                          ],
                        } as any);
                        if (events) clientRes.write(events);
                      }
                      // Silently ignore message type - content is handled by output_text.delta
                    } else if (
                      evtType === 'response.content_part.added' ||
                      evtType === 'response.content_part.done'
                    ) {
                      // Content part events: silently ignore (content is handled by output_text.delta)
                      // These events indicate text/refusal content blocks but actual content comes via delta events
                    } else if (
                      evtType === 'response.function_call_arguments.delta' &&
                      typeof parsed.delta === 'string'
                    ) {
                      // Tool call arguments delta
                      const outputIndex = parsed.output_index ?? 0;
                      const events = translator.translateChunk({
                        choices: [
                          {
                            delta: {
                              tool_calls: [
                                { index: outputIndex, function: { arguments: parsed.delta } },
                              ],
                            },
                          },
                        ],
                      } as any);
                      if (events) clientRes.write(events);
                    } else if (evtType === 'response.function_call_arguments.done') {
                      // Tool call arguments complete: mark as done (translator will handle on finish_reason)
                      this.log('Tool call arguments completed');
                    } else if (evtType === 'response.output_item.done') {
                      // Output item done: handle function_call, ignore message type
                      if (parsed.item?.type === 'function_call') {
                        // Tool call item done: just log, don't finish yet (wait for response.completed)
                        this.log('Tool call item completed');
                      }
                      // Silently ignore message type
                    } else if (
                      evtType === 'response.refusal.delta' &&
                      typeof parsed.delta === 'string'
                    ) {
                      // Refusal text delta: add [refusal] prefix only on first delta
                      const start = translator.translateChunk({
                        choices: [{ delta: { content: '' } }],
                      } as any);
                      const prefix = refusalStarted ? '' : '[refusal] ';
                      const textDelta = translator.translateChunk({
                        choices: [{ delta: { content: `${prefix}${parsed.delta}` } }],
                      } as any);
                      if (start) clientRes.write(start);
                      if (textDelta) clientRes.write(textDelta);
                      refusalStarted = true;
                    } else if (evtType === 'response.refusal.done') {
                      // Refusal complete: close block and finish
                      const events = translator.translateChunk({
                        choices: [{ finish_reason: 'end_turn' }],
                      } as any);
                      if (events) clientRes.write(events);
                      hasFinished = true;
                    } else if (evtType === 'error') {
                      // Keep SSE protocol shape stable: emit error as assistant text, then finish.
                      const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
                      this.log(`Upstream SSE error event: ${errorMsg}`);
                      if (!hasFinished) {
                        const errorDelta = translator.translateChunk({
                          choices: [{ delta: { content: `[upstream_error] ${errorMsg}` } }],
                        } as any);
                        if (errorDelta) clientRes.write(errorDelta);
                        const finishEvent = translator.translateChunk({
                          choices: [{ finish_reason: 'stop' }],
                        } as any);
                        if (finishEvent) clientRes.write(finishEvent);
                        hasFinished = true;
                      }
                    } else if (evtType === 'response.completed') {
                      // Extract usage info and emit final events
                      if (parsed.response?.usage) {
                        translator['inputTokens'] = parsed.response.usage.input_tokens ?? 0;
                        translator['outputTokens'] = parsed.response.usage.output_tokens ?? 0;
                      }
                      // Track response ID for conversation chaining
                      if (parsed.response?.id) {
                        this.lastResponseId = parsed.response.id;
                        this.log(`Stored response ID: ${this.lastResponseId}`);
                      }
                      if (!hasFinished) {
                        hasFinished = true;
                        // If we have active tool calls, emit tool_calls finish_reason
                        if (activeToolCalls.size > 0) {
                          const finishEvent = translator.translateChunk({
                            choices: [{ finish_reason: 'tool_calls' }],
                          } as any);
                          if (finishEvent) clientRes.write(finishEvent);
                        } else {
                          // Only emit final if no tool calls (translateChunk already emitted terminal events)
                          const final = translator.emitFinalIfNeeded();
                          if (final) clientRes.write(final);
                        }
                      }
                    } else if (evtType.startsWith('response.web_search.')) {
                      // Web search events: log for debugging, treat as informational
                      this.log(`Web search event: ${evtType}`);
                      // Could emit as text delta if needed: "[Searching web...]"
                      if (evtType === 'response.web_search.started') {
                        const searchDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Searching web...]\n' } }],
                        } as any);
                        if (searchDelta) clientRes.write(searchDelta);
                      }
                    } else if (evtType.startsWith('response.file_search.')) {
                      // File search events: log for debugging
                      this.log(`File search event: ${evtType}`);
                      if (evtType === 'response.file_search.started') {
                        const searchDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Searching files...]\n' } }],
                        } as any);
                        if (searchDelta) clientRes.write(searchDelta);
                      }
                    } else if (evtType.startsWith('response.code_interpreter.')) {
                      // Code interpreter events: log for debugging
                      this.log(`Code interpreter event: ${evtType}`);
                      if (evtType === 'response.code_interpreter.started') {
                        const codeDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Running code...]\n' } }],
                        } as any);
                        if (codeDelta) clientRes.write(codeDelta);
                      } else if (evtType === 'response.code_interpreter.output' && parsed.output) {
                        // Code output: emit as text
                        const outputDelta = translator.translateChunk({
                          choices: [{ delta: { content: `\`\`\`\n${parsed.output}\n\`\`\`\n` } }],
                        } as any);
                        if (outputDelta) clientRes.write(outputDelta);
                      }
                    } else if (evtType.startsWith('response.mcp.')) {
                      // MCP tool events: log for debugging
                      this.log(`MCP event: ${evtType}`);
                      if (evtType === 'response.mcp.started') {
                        const mcpDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Using MCP tool...]\n' } }],
                        } as any);
                        if (mcpDelta) clientRes.write(mcpDelta);
                      }
                    } else if (evtType === 'response.reasoning_summary_part.added') {
                      // Reasoning block start → Anthropic thinking block
                      const events = translator.emitThinkingStart();
                      if (events) clientRes.write(events);
                    } else if (
                      evtType === 'response.reasoning_summary_text.delta' &&
                      typeof parsed.delta === 'string'
                    ) {
                      // Reasoning text delta → thinking_delta
                      const events = translator.emitThinkingDelta(parsed.delta);
                      if (events) clientRes.write(events);
                    } else if (evtType === 'response.reasoning_summary_part.done') {
                      // Reasoning block done → close thinking block
                      const events = translator.emitThinkingStop();
                      if (events) clientRes.write(events);
                    } else if (evtType.includes('reasoning')) {
                      // Log other reasoning events for debugging
                      this.log(
                        `[REASONING EVENT] ${evtType}: ${JSON.stringify(parsed).slice(0, 200)}`
                      );
                    } else {
                      // Log unknown event types for debugging
                      if (this.config.verbose) {
                        this.log(`Unknown Responses API event type: ${evtType}`);
                      }
                    }
                  } else {
                    const chunkObj = parsed as OpenAIStreamChunk;
                    const events = translator.translateChunk(chunkObj);
                    if (events) clientRes.write(events);
                    if (chunkObj.choices?.[0]?.finish_reason) hasFinished = true;
                  }
                } catch (e) {
                  this.log(
                    `Failed to parse SSE chunk: ${jsonStr.slice(0, 100)} - ${(e as Error).message}`
                  );
                }
              }
            });

            upstreamRes.on('end', () => {
              if (buffer.trim() && !hasFinished) {
                const trailingPayload = extractSSEDataPayload(buffer);
                if (trailingPayload && trailingPayload.trim() !== '[DONE]') {
                  try {
                    const parsed = JSON.parse(trailingPayload);
                    if (parsed && parsed.type) {
                      if (parsed.type === 'response.completed') {
                        hasFinished = true;
                      }
                    } else {
                      const chunk = parsed as OpenAIStreamChunk;
                      const events = translator.translateChunk(chunk);
                      if (events) clientRes.write(events);
                      if (chunk.choices?.[0]?.finish_reason) hasFinished = true;
                    }
                  } catch (e) {
                    this.log(
                      `Failed to parse trailing SSE chunk: ${trailingPayload.slice(0, 100)} - ${(e as Error).message}`
                    );
                  }
                }
              }

              if (!hasFinished) {
                const final = translator.emitFinalIfNeeded();
                if (final) clientRes.write(final);
              }

              if (!clientRes.writableEnded) {
                clientRes.end();
              }
              resolveAttempt();
            });

            upstreamRes.on('error', (err) => {
              if (hasFinished || clientRes.writableEnded) {
                resolveAttempt();
                return;
              }

              if (scheduleNetworkRetry(err, 'response')) {
                return;
              }

              this.log(`Upstream response stream error (${mode}): ${err.message}`);

              if (clientRes.headersSent) {
                const errorDelta = translator.translateChunk({
                  choices: [{ delta: { content: `[upstream_error] ${err.message}` } }],
                } as any);
                if (errorDelta) clientRes.write(errorDelta);

                const finishEvent = translator.translateChunk({
                  choices: [{ finish_reason: 'stop' }],
                } as any);
                if (finishEvent) clientRes.write(finishEvent);

                hasFinished = true;
                if (!clientRes.writableEnded) {
                  clientRes.end();
                }
                resolveAttempt();
                return;
              }

              rejectAttempt(err);
            });
          }
        );

        upstreamReq.on('timeout', () => {
          upstreamReq.destroy(new Error('Upstream request timeout'));
        });
        upstreamReq.on('error', (err) => {
          // On network error for chat attempt, fallback to responses (only if Responses API enabled)
          if (mode === 'chat' && this.config.useResponsesApi && !clientRes.headersSent) {
            attempt('responses').then(resolveAttempt).catch(rejectAttempt);
            return;
          }

          if (scheduleNetworkRetry(err, 'request')) {
            return;
          }

          this.log(`Request error (${mode}): ${err.message}`);
          if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'application/json' });
            clientRes.end(
              JSON.stringify({
                type: 'error',
                error: { type: 'api_error', message: err.message },
              })
            );
          }
          rejectAttempt(err);
        });

        upstreamReq.write(bodyString);
        upstreamReq.end();
      });
    };

    // Start with Responses API for codex, Chat Completions for generic OpenAI endpoints
    await attempt(this.config.useResponsesApi ? 'responses' : 'chat');
  }

  /** For non-streaming requests: call API with stream=true, collect text, return Anthropic JSON */
  private async handleNonStreamingViaStream(
    _req: http.IncomingMessage,
    clientRes: http.ServerResponse,
    targetBase: string,
    openaiReqChat: OpenAIRequest,
    model: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let retried = false;
      let retriedWithoutResponseId = false;
      let retriedWithTrimmedContext = false;
      let networkRetryCount = 0;

      const doRequest = (): void => {
        const scheduleNetworkRetry = (err: Error, source: 'request' | 'response'): boolean => {
          if (
            !this.isRetryableNetworkError(err) ||
            clientRes.headersSent ||
            clientRes.writableEnded
          ) {
            return false;
          }

          const next = networkRetryCount + 1;
          if (next > this.maxNetworkRetries) {
            return false;
          }

          networkRetryCount = next;
          const delay = this.getRetryDelayMs(next, err);
          const seconds = Math.max(1, Math.round(delay / 1000));
          const errCode = String((err as NodeJS.ErrnoException).code || '');
          if (errCode === 'ECONNRESET') {
            this.log(
              `Connection reset by server [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}] (non-stream, ${source})`
            );
          } else {
            this.log(
              `Transient non-stream network error (${source}): ${err.message} [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}]`
            );
          }
          setTimeout(() => doRequest(), delay);
          return true;
        };
        // Use Responses API for codex, Chat Completions for generic OpenAI endpoints
        const useResponses = this.config.useResponsesApi;
        const targetUrl = new URL(
          `${targetBase}${useResponses ? '/v1/responses' : '/v1/chat/completions'}`
        );
        const body = useResponses
          ? translateChatToResponses(
              JSON.parse(JSON.stringify({ ...openaiReqChat, stream: true })) as OpenAIRequest,
              this.lastResponseId,
              this.toolNameMap
            )
          : { ...openaiReqChat, stream: true };
        const bodyString = JSON.stringify(body);
        this.log(`[DEBUG] Upstream non-stream URL: ${targetUrl.href}`);
        this.log(`[DEBUG] Upstream non-stream request body:\n${bodyString.slice(0, 2000)}`);
        const requestFn = targetUrl.protocol === 'https:' ? https.request : http.request;

        // Build headers: include codex session headers only when using Responses API
        const nonStreamHeaders: Record<string, string | number> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'text/event-stream',
          'User-Agent': CODEX_USER_AGENT,
        };
        if (useResponses) {
          nonStreamHeaders['x-session-id'] = 'ccs-codex-stable';
          nonStreamHeaders['conversation_id'] = 'ccs-codex-stable';
          nonStreamHeaders['session_id'] = 'ccs-codex-stable';
        }

        const upstreamReq = requestFn(
          {
            protocol: targetUrl.protocol,
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname + targetUrl.search,
            method: 'POST',
            timeout: this.config.timeoutMs,
            agent: targetUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent,
            headers: nonStreamHeaders,
          },
          (upstreamRes) => {
            const statusCode = upstreamRes.statusCode || 200;

            if (statusCode >= 400) {
              const chunks: Buffer[] = [];
              upstreamRes.on('data', (c: Buffer) => chunks.push(c));
              upstreamRes.on('end', () => {
                const bodyErr = Buffer.concat(chunks).toString('utf8');
                this.log(`Upstream non-stream error ${statusCode}: ${bodyErr.slice(0, 1000)}`);
                // Auto-retry once on 401
                if (statusCode === 401 && !retried) {
                  retried = true;
                  this.log('401 received (non-stream), retrying once...');
                  setTimeout(() => doRequest(), 500);
                  return;
                }

                // If using previous_response_id and got an error, clear it and retry with full request
                if (this.lastResponseId && !retriedWithoutResponseId && !clientRes.headersSent) {
                  retriedWithoutResponseId = true;
                  this.log(
                    `Clearing stale previous_response_id (${this.lastResponseId}) due to ${statusCode} (non-stream), retrying with full request`
                  );
                  this.lastResponseId = null;
                  networkRetryCount = 0;
                  doRequest();
                  return;
                }

                // Context window overflow: trim old messages and retry once
                if (
                  this.isContextWindowError(bodyErr) &&
                  !retriedWithTrimmedContext &&
                  !clientRes.headersSent
                ) {
                  retriedWithTrimmedContext = true;
                  this.lastResponseId = null;
                  if (this.trimMessages(openaiReqChat.messages)) {
                    networkRetryCount = 0;
                    doRequest();
                    return;
                  }
                }

                if (this.isRetryableStatusCode(statusCode) && !clientRes.headersSent) {
                  const next = networkRetryCount + 1;
                  if (next <= this.maxNetworkRetries) {
                    networkRetryCount = next;
                    const delay = this.getRetryDelayMs(next);
                    const seconds = Math.max(1, Math.round(delay / 1000));
                    this.log(
                      `Transient upstream status ${statusCode} [retrying in ${seconds}s attempt #${next}/${this.maxNetworkRetries}] (non-stream)`
                    );
                    setTimeout(() => doRequest(), delay);
                    return;
                  }
                }

                clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
                clientRes.end(
                  JSON.stringify({
                    type: 'error',
                    error: { type: 'api_error', message: bodyErr.slice(0, 500) },
                  })
                );
                resolve();
              });
              return;
            }

            // Collect text, thinking, and tool calls from streaming events
            let buffer = '';
            let collectedText = '';
            let collectedThinking = '';
            const collectedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
            const activeToolCallsMap = new Map<
              number,
              { id: string; name: string; arguments: string }
            >();
            let inputTokens = 0;
            let outputTokens = 0;

            upstreamRes.on('data', (chunk: Buffer) => {
              buffer += chunk.toString('utf8');
              const parsedEvents = consumeSSEEvents(buffer);
              buffer = parsedEvents.rest;

              for (const event of parsedEvents.events) {
                const payload = extractSSEDataPayload(event);
                if (!payload || payload.trim() === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(payload);

                  // Chat Completions format (no .type field, has .choices)
                  if (!parsed?.type && parsed?.choices) {
                    const choice = parsed.choices[0];
                    if (choice?.delta?.content) collectedText += choice.delta.content;
                    if (choice?.delta?.reasoning_content)
                      collectedThinking += choice.delta.reasoning_content;
                    if (choice?.delta?.tool_calls) {
                      for (const tc of choice.delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (tc.id) {
                          activeToolCallsMap.set(idx, {
                            id: tc.id,
                            name:
                              this.toolNameMap.get(tc.function?.name || '') ||
                              tc.function?.name ||
                              '',
                            arguments: '',
                          });
                        }
                        if (tc.function?.arguments) {
                          const existing = activeToolCallsMap.get(idx);
                          if (existing) existing.arguments += tc.function.arguments;
                        }
                      }
                    }
                    if (choice?.finish_reason && choice.finish_reason !== 'stop') {
                      // Tool calls finished
                      for (const [idx, tc] of activeToolCallsMap) {
                        collectedToolCalls.push(tc);
                        activeToolCallsMap.delete(idx);
                      }
                    }
                    if (parsed.usage) {
                      inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
                      outputTokens = parsed.usage.completion_tokens ?? outputTokens;
                    }
                    continue;
                  }

                  // Responses API format (has .type field)
                  if (!parsed?.type) continue;
                  const evtType: string = parsed.type;

                  if (evtType.endsWith('.output_text.delta') && typeof parsed.delta === 'string') {
                    collectedText += parsed.delta;
                  } else if (
                    evtType === 'response.reasoning_summary_text.delta' &&
                    typeof parsed.delta === 'string'
                  ) {
                    collectedThinking += parsed.delta;
                  } else if (
                    evtType === 'response.output_item.added' &&
                    parsed.item?.type === 'function_call'
                  ) {
                    const outputIndex = parsed.output_index ?? 0;
                    activeToolCallsMap.set(outputIndex, {
                      id: parsed.item.call_id || parsed.item.id || `call_${Date.now()}`,
                      name: this.toolNameMap.get(parsed.item.name || '') || parsed.item.name || '',
                      arguments: '',
                    });
                  } else if (
                    evtType === 'response.function_call_arguments.delta' &&
                    typeof parsed.delta === 'string'
                  ) {
                    const outputIndex = parsed.output_index ?? 0;
                    const toolCall = activeToolCallsMap.get(outputIndex);
                    if (toolCall) {
                      toolCall.arguments += parsed.delta;
                    }
                  } else if (
                    evtType === 'response.output_item.done' &&
                    parsed.item?.type === 'function_call'
                  ) {
                    const outputIndex = parsed.output_index ?? 0;
                    const toolCall = activeToolCallsMap.get(outputIndex);
                    if (toolCall) {
                      collectedToolCalls.push(toolCall);
                      activeToolCallsMap.delete(outputIndex);
                    }
                  } else if (evtType === 'response.completed') {
                    if (parsed.response?.usage) {
                      inputTokens = parsed.response.usage.input_tokens ?? 0;
                      outputTokens = parsed.response.usage.output_tokens ?? 0;
                    }
                    if (parsed.response?.id) {
                      this.lastResponseId = parsed.response.id;
                    }
                  }
                } catch (e) {
                  this.log(
                    `Failed to parse non-stream SSE chunk: ${payload.slice(0, 100)} - ${(e as Error).message}`
                  );
                }
              }
            });

            upstreamRes.on('end', () => {
              // Build Anthropic Messages API response
              const content: unknown[] = [];
              if (collectedThinking) {
                content.push({ type: 'thinking', thinking: collectedThinking, signature: '' });
              }
              if (collectedText) {
                content.push({ type: 'text', text: collectedText });
              }
              for (const tc of collectedToolCalls) {
                let input: unknown = {};
                try {
                  input = JSON.parse(tc.arguments);
                } catch {
                  input = tc.arguments;
                }
                content.push({
                  type: 'tool_use',
                  id: tc.id,
                  name: this.toolNameMap.get(tc.name) || tc.name,
                  input,
                });
              }

              const stopReason = collectedToolCalls.length > 0 ? 'tool_use' : 'end_turn';
              const anthropicResp = {
                id: `msg_${Date.now().toString(36)}`,
                type: 'message',
                role: 'assistant',
                content,
                model,
                stop_reason: stopReason,
                stop_sequence: null,
                usage: { input_tokens: inputTokens, output_tokens: outputTokens },
              };

              clientRes.writeHead(200, { 'Content-Type': 'application/json' });
              clientRes.end(JSON.stringify(anthropicResp));
              resolve();
            });

            upstreamRes.on('error', (err) => {
              if (scheduleNetworkRetry(err, 'response')) {
                return;
              }
              reject(err);
            });
          }
        );

        upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream request timeout')));
        upstreamReq.on('error', (err) => {
          if (scheduleNetworkRetry(err, 'request')) {
            return;
          }

          this.log(`Non-stream request error: ${err.message}`);
          if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'application/json' });
            clientRes.end(
              JSON.stringify({ type: 'error', error: { type: 'api_error', message: err.message } })
            );
          }
          reject(err);
        });

        upstreamReq.write(bodyString);
        upstreamReq.end();
      }; // end doRequest

      doRequest();
    });
  }
}
