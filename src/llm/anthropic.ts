import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMResponse, Message, ToolDefinition } from '../types/llm.js';
import type { LLMProviderConfig } from '../types/config.js';

export class AnthropicProvider implements LLMProvider {
  id: string;
  type = 'anthropic';
  private client: Anthropic | null = null;
  private model: string;
  private maxTokens: number;
  private apiKey: string;

  constructor(config: LLMProviderConfig) {
    this.id = config.id;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.apiKey = config.apiKey;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages: Anthropic.MessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'system') continue;

      if (m.role === 'assistant' && m.toolCalls?.length) {
        const content: Anthropic.ContentBlockParam[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
        }
        chatMessages.push({ role: 'assistant', content });
      } else if (m.role === 'tool_results' && m.toolResults?.length) {
        const content: Anthropic.ToolResultBlockParam[] = m.toolResults.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.id,
          content: r.content,
          is_error: r.error || false,
        }));
        chatMessages.push({ role: 'user', content });
      } else {
        chatMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
      }
    }

    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: chatMessages,
    };

    if (systemMessage) {
      params.system = systemMessage.content;
    }

    if (tools?.length) {
      params.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool['input_schema'],
      }));
    }

    const response = await this.getClient().messages.create(params);

    const textBlocks = response.content.filter((b) => b.type === 'text');
    const toolBlocks = response.content.filter((b) => b.type === 'tool_use');

    return {
      content: textBlocks.map((b) => b.text).join('\n'),
      toolCalls: toolBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        arguments: b.input as Record<string, unknown>,
      })),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
