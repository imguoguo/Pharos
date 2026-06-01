export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  error?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool_results';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProvider {
  id: string;
  type: string;
  chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
