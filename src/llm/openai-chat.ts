import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, Message, ToolDefinition } from '../types/llm.js';
import type { LLMProviderConfig } from '../types/config.js';

export class OpenAIChatProvider implements LLMProvider {
  id: string;
  type = 'openai-chat';
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(config: LLMProviderConfig) {
    this.id = config.id;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.client = new OpenAI({
      apiKey: config.apiKey || 'placeholder',
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const chatMessages: OpenAI.ChatCompletionMessageParam[] = [];

    for (const m of messages) {
      if (m.role === 'assistant' && m.toolCalls?.length) {
        chatMessages.push({
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });
      } else if (m.role === 'tool_results' && m.toolResults?.length) {
        for (const r of m.toolResults) {
          chatMessages.push({
            role: 'tool',
            tool_call_id: r.id,
            content: r.content,
          });
        }
      } else {
        chatMessages.push({ role: m.role as 'system' | 'user' | 'assistant', content: m.content });
      }
    }

    const params: OpenAI.ChatCompletionCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: chatMessages,
    };

    if (tools?.length) {
      params.tools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content ?? '',
      toolCalls: message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }
}
