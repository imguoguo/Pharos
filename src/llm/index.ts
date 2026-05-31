import type { LLMProvider } from '../types/llm.js';
import type { LLMProviderConfig } from '../types/config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIChatProvider } from './openai-chat.js';
import { OpenAIResponsesProvider } from './openai-responses.js';

const providers = new Map<string, LLMProvider>();

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
