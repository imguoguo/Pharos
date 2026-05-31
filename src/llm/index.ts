import type { LLMProvider, LLMResponse, Message, ToolDefinition } from '../types/llm.js';
import type { LLMProviderConfig } from '../types/config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIChatProvider } from './openai-chat.js';
import { OpenAIResponsesProvider } from './openai-responses.js';
import { appendLog } from '../config/index.js';

const providers = new Map<string, LLMProvider>();
let providerConfigs: LLMProviderConfig[] = [];

export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai-chat':
      return new OpenAIChatProvider(config);
    case 'openai-responses':
      return new OpenAIResponsesProvider(config);
    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }
}

export function initProviders(configs: LLMProviderConfig[]): void {
  providers.clear();
  providerConfigs = configs;
  for (const config of configs) {
    providers.set(config.id, createProvider(config));
  }
}

export function getProvider(id: string): LLMProvider {
  const provider = providers.get(id);
  if (!provider) {
    throw new Error(`Provider not found: ${id}`);
  }
  return provider;
}

export function getAllProviders(): LLMProvider[] {
  return Array.from(providers.values());
}

export function getEnabledProvidersSorted(): { provider: LLMProvider; config: LLMProviderConfig }[] {
  return providerConfigs
    .filter((c) => c.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map((c) => ({ provider: providers.get(c.id)!, config: c }))
    .filter((p) => p.provider);
}

export async function chatWithFallback(
  messages: Message[],
  tools?: ToolDefinition[],
): Promise<LLMResponse & { providerId: string }> {
  const pool = getEnabledProvidersSorted();
  if (pool.length === 0) {
    throw new Error('No LLM provider enabled. Please enable at least one provider in the web panel.');
  }

  for (let i = 0; i < pool.length; i++) {
    const { provider, config } = pool[i];
    try {
      const response = await provider.chat(messages, tools);
      return { ...response, providerId: config.id };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      appendLog('warn', `Provider ${config.name} failed: ${error}`);
      if (i === pool.length - 1) {
        throw new Error(`All providers failed. Last error: ${error}`);
      }
    }
  }

  throw new Error('No providers available');
}
