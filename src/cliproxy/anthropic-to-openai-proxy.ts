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

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

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
              arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {}),
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

function toResponsesMessages(messages: OpenAIMessage[]): ResponsesMessage[] {
  const out: ResponsesMessage[] = [];

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
          out.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          } as any);
        }
      }
    } else if (m.role === 'tool') {
      // Tool results: use function_call_output format
      out.push({
        type: 'function_call_output',
        call_id: m.tool_call_id || '',
        output: m.content || '',
      } as any);
    } else {
      // User/system/developer messages: use simplified format
      const textContent = m.content ?? '';
      out.push({ role: m.role, content: textContent } as any);
    }
  }

  return out;
}

function translateChatToResponses(chat: OpenAIRequest): ResponsesRequest {
  // chat is already an OpenAI Chat Completions payload; convert messages to Responses format
  const req: ResponsesRequest = {
    model: chat.model,
    input: toResponsesMessages(chat.messages),
    stream: chat.stream,
    temperature: chat.temperature,
    top_p: chat.top_p,
    stop: chat.stop,
    reasoning: chat.reasoning ?? { effort: 'xhigh' },
  };
  if (chat.tools) {
    // Convert Chat Completions tool format to Responses API format
    // Chat: {type:"function", function:{name, description, parameters}}
    // Responses: {type:"function", name, description, parameters}
    req.tools = chat.tools.map((t: OpenAITool) => ({
      type: 'function' as const,
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }));
  }
  if (chat.tool_choice) req.tool_choice = chat.tool_choice as any;
  return req;
}

// ─── Streaming Response Translation ──────────────────────────────────────────

/** State tracker for translating OpenAI streaming chunks into Anthropic SSE events */
class StreamingResponseTranslator {
  private messageId: string;
  private model: string;
  private contentBlockIndex = 0;
  private inTextBlock = false;
  private inToolCallBlocks = new Map<number, { id: string; name: string; started: boolean }>();
  private inputTokens = 0;
  private outputTokens = 0;
  private headersSent = false;

  constructor(model: string) {
    this.messageId = `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.model = model;
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
          tracked = { id: tc.id, name: tc.function.name, started: false };
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
        }

        // Emit argument deltas
        if (tc.function?.arguments) {
          events += this.sse('content_block_delta', {
            type: 'content_block_delta',
            index: this.contentBlockIndex,
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

      // Close open tool call blocks
      for (const [, tracked] of this.inToolCallBlocks) {
        if (tracked.started) {
          events += this.sse('content_block_stop', {
            type: 'content_block_stop',
            index: this.contentBlockIndex,
          });
          this.contentBlockIndex++;
        }
      }
      this.inToolCallBlocks.clear();

      // Map finish reason
      const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';

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

    if (this.inTextBlock) {
      events += this.sse('content_block_stop', {
        type: 'content_block_stop',
        index: this.contentBlockIndex,
      });
    }

    for (const [, tracked] of this.inToolCallBlocks) {
      if (tracked.started) {
        events += this.sse('content_block_stop', {
          type: 'content_block_stop',
          index: this.contentBlockIndex,
        });
        this.contentBlockIndex++;
      }
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

// ─── Proxy Server ────────────────────────────────────────────────────────────

export class AnthropicToOpenAIProxy {
  private server: http.Server | null = null;
  private port: number | null = null;
  private readonly config: Required<Pick<AnthropicToOpenAIProxyConfig, 'targetBaseUrl' | 'apiKey' | 'verbose' | 'timeoutMs'>>;

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
    };
  }

  private log(msg: string): void {
    if (this.config.verbose) {
      console.error(`[anthropic-to-openai] ${msg}`);
    }
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
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  stop(): void {
    if (!this.server) return;
    this.server.close();
    this.server = null;
    this.port = null;
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
      this.log(`Translated request: model=${model}, stream=${openaiReq.stream}, messages=${openaiReq.messages.length}`);

      // Build target base URL (without endpoint path)
      const targetBase = this.config.targetBaseUrl;

      // This API only supports streaming Responses API
      const wantStream = !!openaiReq.stream;
      openaiReq.stream = true; // force streaming for API
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
      }
      // Return error in Anthropic format
      res.end(JSON.stringify({
        type: 'error',
        error: { type: 'api_error', message: err.message },
      }));
    }
  }

  private async handleStreaming(
    _req: http.IncomingMessage,
    clientRes: http.ServerResponse,
    targetBase: string,
    openaiReqChat: OpenAIRequest,
    model: string
  ): Promise<void> {
    return new Promise((_resolve, _reject) => {
      const attempt = (mode: 'chat' | 'responses'): Promise<void> => {
        return new Promise((resolveAttempt, rejectAttempt) => {
          const targetUrl = new URL(`${targetBase}${mode === 'chat' ? '/v1/chat/completions' : '/v1/responses'}`);
          const body = mode === 'chat' ? openaiReqChat : translateChatToResponses(JSON.parse(JSON.stringify({ ...openaiReqChat, stream: true })) as any);
          const bodyString = JSON.stringify(body);
          const requestFn = targetUrl.protocol === 'https:' ? https.request : http.request;

          const upstreamReq = requestFn(
            {
              protocol: targetUrl.protocol,
              hostname: targetUrl.hostname,
              port: targetUrl.port,
              path: targetUrl.pathname + targetUrl.search,
              method: 'POST',
              timeout: this.config.timeoutMs,
              headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyString),
            'Authorization': `Bearer ${this.config.apiKey}`,
'Accept': 'text/event-stream',
              },
            },
            (upstreamRes) => {
          const statusCode = upstreamRes.statusCode || 200;

          if (statusCode >= 400) {
            const chunks: Buffer[] = [];
            upstreamRes.on('data', (c: Buffer) => chunks.push(c));
            upstreamRes.on('end', () => {
              const bodyErr = Buffer.concat(chunks).toString('utf8');
              this.log(`Upstream ${mode} error ${statusCode}: ${bodyErr.slice(0, 200)}`);
              // Try fallback if we attempted chat first
              if (mode === 'chat') {
                attempt('responses').then(resolveAttempt).catch(rejectAttempt);
                return;
              }
              // No fallback left: return error
              if (!clientRes.headersSent) {
                clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
              }
              try {
                const parsed = JSON.parse(bodyErr);
                clientRes.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: parsed?.error?.message || bodyErr.slice(0, 500) } }));
              } catch {
                clientRes.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: bodyErr.slice(0, 500) } }));
              }
              resolveAttempt();
            });
            return;
          }

          // Set up Anthropic SSE response
          clientRes.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });

          const translator = new StreamingResponseTranslator(model);
          let buffer = '';
          let hasFinished = false;
          const activeToolCalls = new Map<number, { id: string; name: string }>();
          let refusalStarted = false;

          upstreamRes.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;

              if (trimmed === 'data: [DONE]') {
                if (!hasFinished) {
                  const final = translator.emitFinalIfNeeded();
                  if (final) clientRes.write(final);
                  hasFinished = true;
                }
                continue;
              }

              if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.slice(6);
                try {
                  // Try Chat Completions chunk first
                  const parsed = JSON.parse(jsonStr);
                  if (parsed && parsed.type) {
                    // Responses API event
                    const evtType: string = parsed.type;
                    if (evtType.endsWith('.output_text.delta') && typeof parsed.delta === 'string') {
                      // Start block if needed, then stream text
                      const start = translator.translateChunk({ choices: [{ delta: { content: '' } }] } as any);
                      const textDelta = translator.translateChunk({ choices: [{ delta: { content: parsed.delta } }] } as any);
                      if (start) clientRes.write(start);
                      if (textDelta) clientRes.write(textDelta);
                    } else if (evtType === 'response.output_text.done') {
                      // Text block complete: close text block if open
                      const events = translator.translateChunk({
                        choices: [{ delta: {} }]
                      } as any);
                      if (events) clientRes.write(events);
                    } else if (evtType === 'response.output_item.added' && parsed.item?.type === 'function_call') {
                      // Tool call start: emit as Anthropic tool_use via fake chunk
                      const tcId = parsed.item.call_id || parsed.item.id || `call_${Date.now()}`;
                      const tcName = parsed.item.name || '';
                      const outputIndex = parsed.output_index ?? 0;
                      activeToolCalls.set(outputIndex, { id: tcId, name: tcName });
                      const events = translator.translateChunk({
                        choices: [{ delta: { tool_calls: [{ index: outputIndex, id: tcId, function: { name: tcName, arguments: '' } }] } }]
                      } as any);
                      if (events) clientRes.write(events);
                    } else if (evtType === 'response.function_call_arguments.delta' && typeof parsed.delta === 'string') {
                      // Tool call arguments delta
                      const outputIndex = parsed.output_index ?? 0;
                      const events = translator.translateChunk({
                        choices: [{ delta: { tool_calls: [{ index: outputIndex, function: { arguments: parsed.delta } }] } }]
                      } as any);
                      if (events) clientRes.write(events);
                    } else if (evtType === 'response.function_call_arguments.done') {
                      // Tool call arguments complete: mark as done (translator will handle on finish_reason)
                      this.log('Tool call arguments completed');
                    } else if (evtType === 'response.output_item.done' && parsed.item?.type === 'function_call') {
                      // Tool call item done: just log, don't finish yet (wait for response.completed)
                      this.log('Tool call item completed');
                    } else if (evtType === 'response.refusal.delta' && typeof parsed.delta === 'string') {
                      // Refusal text delta: add [refusal] prefix only on first delta
                      const start = translator.translateChunk({ choices: [{ delta: { content: '' } }] } as any);
                      const prefix = refusalStarted ? '' : '[refusal] ';
                      const textDelta = translator.translateChunk({ choices: [{ delta: { content: `${prefix}${parsed.delta}` } }] } as any);
                      if (start) clientRes.write(start);
                      if (textDelta) clientRes.write(textDelta);
                      refusalStarted = true;
                    } else if (evtType === 'response.refusal.done') {
                      // Refusal complete: close block and finish
                      const events = translator.translateChunk({
                        choices: [{ finish_reason: 'end_turn' }]
                      } as any);
                      if (events) clientRes.write(events);
                      hasFinished = true;
                    } else if (evtType === 'error') {
                      // Stream error: return Anthropic error format and end
                      const errorMsg = parsed.error?.message || parsed.message || 'Unknown error';
                      if (!clientRes.headersSent) {
                        clientRes.writeHead(500, { 'Content-Type': 'application/json' });
                      }
                      clientRes.end(JSON.stringify({
                        type: 'error',
                        error: { type: 'api_error', message: errorMsg }
                      }));
                      hasFinished = true;
                      return;
                    } else if (evtType === 'response.completed') {
                      // Extract usage info and emit final events
                      if (parsed.response?.usage) {
                        translator['inputTokens'] = parsed.response.usage.input_tokens ?? 0;
                        translator['outputTokens'] = parsed.response.usage.output_tokens ?? 0;
                      }
                      if (!hasFinished) {
                        hasFinished = true;
                        // If we have active tool calls, emit tool_calls finish_reason
                        if (activeToolCalls.size > 0) {
                          const finishEvent = translator.translateChunk({
                            choices: [{ finish_reason: 'tool_calls' }]
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
                          choices: [{ delta: { content: '[Searching web...]\n' } }]
                        } as any);
                        if (searchDelta) clientRes.write(searchDelta);
                      }
                    } else if (evtType.startsWith('response.file_search.')) {
                      // File search events: log for debugging
                      this.log(`File search event: ${evtType}`);
                      if (evtType === 'response.file_search.started') {
                        const searchDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Searching files...]\n' } }]
                        } as any);
                        if (searchDelta) clientRes.write(searchDelta);
                      }
                    } else if (evtType.startsWith('response.code_interpreter.')) {
                      // Code interpreter events: log for debugging
                      this.log(`Code interpreter event: ${evtType}`);
                      if (evtType === 'response.code_interpreter.started') {
                        const codeDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Running code...]\n' } }]
                        } as any);
                        if (codeDelta) clientRes.write(codeDelta);
                      } else if (evtType === 'response.code_interpreter.output' && parsed.output) {
                        // Code output: emit as text
                        const outputDelta = translator.translateChunk({
                          choices: [{ delta: { content: `\`\`\`\n${parsed.output}\n\`\`\`\n` } }]
                        } as any);
                        if (outputDelta) clientRes.write(outputDelta);
                      }
                    } else if (evtType.startsWith('response.mcp.')) {
                      // MCP tool events: log for debugging
                      this.log(`MCP event: ${evtType}`);
                      if (evtType === 'response.mcp.started') {
                        const mcpDelta = translator.translateChunk({
                          choices: [{ delta: { content: '[Using MCP tool...]\n' } }]
                        } as any);
                        if (mcpDelta) clientRes.write(mcpDelta);
                      }
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
                  this.log(`Failed to parse SSE chunk: ${jsonStr.slice(0, 100)} - ${(e as Error).message}`);
                }
              }
            }
          });

          upstreamRes.on('end', () => {
            if (buffer.trim()) {
              const trimmed = buffer.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
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
                } catch {
                  // ignore
                }
              }
            }

            if (!hasFinished) {
              const final = translator.emitFinalIfNeeded();
              if (final) clientRes.write(final);
            }

            clientRes.end();
            resolveAttempt();
          });

          upstreamRes.on('error', rejectAttempt);
        });

        upstreamReq.on('timeout', () => {
          upstreamReq.destroy(new Error('Upstream request timeout'));
        });

        upstreamReq.on('error', (err) => {
          // On network error for chat attempt, fallback to responses
          if (mode === 'chat') {
            attempt('responses').then(resolveAttempt).catch(rejectAttempt);
            return;
          }
          this.log(`Request error (${mode}): ${err.message}`);
          if (!clientRes.headersSent) {
            clientRes.writeHead(502, { 'Content-Type': 'application/json' });
            clientRes.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: err.message } }));
          }
          rejectAttempt(err);
        });

        upstreamReq.write(bodyString);
        upstreamReq.end();
      });
      };

      return attempt('responses');
    });
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
      const targetUrl = new URL(`${targetBase}/v1/responses`);
      const body = translateChatToResponses(JSON.parse(JSON.stringify({ ...openaiReqChat, stream: true })) as OpenAIRequest);
      const bodyString = JSON.stringify(body);
      const requestFn = targetUrl.protocol === 'https:' ? https.request : http.request;

      const upstreamReq = requestFn(
        {
          protocol: targetUrl.protocol,
          hostname: targetUrl.hostname,
          port: targetUrl.port,
          path: targetUrl.pathname + targetUrl.search,
          method: 'POST',
          timeout: this.config.timeoutMs,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyString),
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Accept': 'text/event-stream',
          },
        },
        (upstreamRes) => {
          const statusCode = upstreamRes.statusCode || 200;

          if (statusCode >= 400) {
            const chunks: Buffer[] = [];
            upstreamRes.on('data', (c: Buffer) => chunks.push(c));
            upstreamRes.on('end', () => {
              const bodyErr = Buffer.concat(chunks).toString('utf8');
              this.log(`Upstream non-stream error ${statusCode}: ${bodyErr.slice(0, 200)}`);
              clientRes.writeHead(statusCode, { 'Content-Type': 'application/json' });
              clientRes.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: bodyErr.slice(0, 500) } }));
              resolve();
            });
            return;
          }

          // Collect text and tool calls from streaming events
          let buffer = '';
          let collectedText = '';
          const collectedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
          const activeToolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
          let inputTokens = 0;
          let outputTokens = 0;

          upstreamRes.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':') || trimmed === 'data: [DONE]') continue;
              if (!trimmed.startsWith('data: ')) continue;

              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (!parsed?.type) continue;
                const evtType: string = parsed.type;

                if (evtType.endsWith('.output_text.delta') && typeof parsed.delta === 'string') {
                  collectedText += parsed.delta;
                } else if (evtType === 'response.output_item.added' && parsed.item?.type === 'function_call') {
                  const outputIndex = parsed.output_index ?? 0;
                  activeToolCallsMap.set(outputIndex, {
                    id: parsed.item.call_id || parsed.item.id || `call_${Date.now()}`,
                    name: parsed.item.name || '',
                    arguments: '',
                  });
                } else if (evtType === 'response.function_call_arguments.delta' && typeof parsed.delta === 'string') {
                  const outputIndex = parsed.output_index ?? 0;
                  const toolCall = activeToolCallsMap.get(outputIndex);
                  if (toolCall) {
                    toolCall.arguments += parsed.delta;
                  }
                } else if (evtType === 'response.output_item.done' && parsed.item?.type === 'function_call') {
                  const outputIndex = parsed.output_index ?? 0;
                  const toolCall = activeToolCallsMap.get(outputIndex);
                  if (toolCall) {
                    collectedToolCalls.push(toolCall);
                    activeToolCallsMap.delete(outputIndex);
                  }
                } else if (evtType === 'response.completed' && parsed.response?.usage) {
                  inputTokens = parsed.response.usage.input_tokens ?? 0;
                  outputTokens = parsed.response.usage.output_tokens ?? 0;
                }
              } catch {
                // ignore parse errors
              }
            }
          });

          upstreamRes.on('end', () => {
            // Build Anthropic Messages API response
            const content: unknown[] = [];
            if (collectedText) {
              content.push({ type: 'text', text: collectedText });
            }
            for (const tc of collectedToolCalls) {
              let input: unknown = {};
              try { input = JSON.parse(tc.arguments); } catch { input = tc.arguments; }
              content.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
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

          upstreamRes.on('error', reject);
        }
      );

      upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('Upstream request timeout')));
      upstreamReq.on('error', (err) => {
        this.log(`Non-stream request error: ${err.message}`);
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
          clientRes.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: err.message } }));
        }
        reject(err);
      });

      upstreamReq.write(bodyString);
      upstreamReq.end();
    });
  }
}
