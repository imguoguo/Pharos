export interface DiscordConfig {
  token: string;
  clientId: string;
  allowedChannels: string[];
  adminRoles: string[];
}

export interface LLMProviderConfig {
  id: string;
  type: 'anthropic' | 'openai-chat' | 'openai-responses';
  name: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  maxOutputTokens?: number;
}

export interface LLMConfig {
  providers: LLMProviderConfig[];
  defaultProvider: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'git-repo';
  path: string;
  include?: string[];
  exclude?: string[];
  enabled: boolean;
}

export interface KnowledgeConfig {
  sources: KnowledgeSource[];
}

export interface SandboxConfig {
  enabled: boolean;
  workDir: string;
}

export interface AgentConfig {
  timeout: number;
  maxConcurrency: number;
  sandbox: SandboxConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface AppConfig {
  discord: DiscordConfig;
  llm: LLMConfig;
  knowledge: KnowledgeConfig;
  agent: AgentConfig;
  server: ServerConfig;
}
