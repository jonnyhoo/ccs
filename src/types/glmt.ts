/**
 * GLMT Proxy Types
 * For Anthropic ↔ OpenAI format transformation
 */

/**
 * Anthropic API types
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  tools?: AnthropicTool[];
  stream?: boolean;
  thinking?: {
    type: 'enabled' | 'disabled';
    budget_tokens?: number;
  };
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * OpenAI API types (Z.AI endpoint)
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  reasoning_content?: string; // Thinking blocks
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_completion_tokens?: number;
  temperature?: number;
  tools?: OpenAITool[];
  stream?: boolean;
  reasoning?: boolean; // Enable thinking mode
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * SSE (Server-Sent Events) types
 */
export interface SSEEvent {
  event?: string;
  data?: string;
  id?: string;
}

export interface DeltaChunk {
  reasoning_content?: string;
  content?: string;
  tool_calls?: OpenAIToolCall[];
}

/**
 * Transformation context
 */
export interface TransformationContext {
  verbose: boolean;
  debugLog: boolean;
  streaming: boolean;
}