import OpenAI from 'openai';
import type { LLMProvider, LLMResponse, Message, ToolDefinition } from '../types/llm.js';
import type { LLMProviderConfig } from '../types/config.js';

export class OpenAIResponsesProvider implements LLMProvider {
  id: string;
  type = 'openai-responses';
  private client: OpenAI;
  private model: string;
  private maxOutputTokens: number;

  constructor(config: LLMProviderConfig) {
    this.id = config.id;
    this.model = config.model;
    this.maxOutputTokens = config.maxOutputTokens ?? 4096;
    this.client = new OpenAI({
      apiKey: config.apiKey || 'placeholder',
      baseURL: config.baseUrl,
    });
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const input: OpenAI.Responses.ResponseInput = [];

    for (const m of messages) {
      if (m.role === 'assistant' && m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          } as any);
        }
      } else if (m.role === 'tool_results' && m.toolResults?.length) {
        for (const r of m.toolResults) {
          input.push({
            type: 'function_call_output',
            call_id: r.id,
            output: r.content,
          } as any);
        }
      } else {
        input.push({
          role: m.role === 'system' ? ('developer' as const) : (m.role as 'user' | 'assistant'),
          content: m.content,
        });
      }
    }

    const params: OpenAI.Responses.ResponseCreateParams = {
      model: this.model,
      input,
      max_output_tokens: this.maxOutputTokens,
    };

    if (tools?.length) {
      params.tools = tools.map((t) => ({
        type: 'function' as const,
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        strict: false,
      }));
    }

    const response = await this.client.responses.create(params);

    let content = '';
    const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];

    for (const item of response.output) {
      if (item.type === 'message') {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            content += part.text;
          }
        }
      } else if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          name: item.name,
          arguments: JSON.parse(item.arguments),
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
    };
  }
}
