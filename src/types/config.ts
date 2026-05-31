export interface DiscordConfig {
  token: string;
  appId: string;
  publicKey: string;
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

export type SourceSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'git-repo' | 'url';
  path: string;
  include?: string[];
  exclude?: string[];
  enabled: boolean;
  remoteUrl?: string;
  branch?: string;
  syncStatus?: SourceSyncStatus;
  syncError?: string;
  syncIntervalMinutes?: number;
  lastSyncAt?: string;
  nextSyncAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  sources: KnowledgeSource[];
  channels: string[];
  createdAt: string;
  updatedAt: string;
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

export interface AuthConfig {
  password: string;
  tokenExpiry: number;
}

export interface AppConfig {
  discord: DiscordConfig;
  llm: LLMConfig;
  projects: Project[];
  agent: AgentConfig;
  server: ServerConfig;
  auth: AuthConfig;
}
