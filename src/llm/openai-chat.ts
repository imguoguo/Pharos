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
    const params: OpenAI.ChatCompletionCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
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
