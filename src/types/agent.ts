export interface AgentStep {
  type: 'llm_call' | 'tool_call' | 'tool_result';
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  content: string;
  providerId?: string;
}

export interface AgentTask {
  id: string;
  query: string;
  channelId: string;
  userId: string;
  messageId: string;
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  steps: AgentStep[];
  startedAt?: string;
  completedAt?: string;
}

export interface ConversationEntry {
  id: string;
  channelId: string;
  guildId: string;
  userId: string;
  username: string;
  query: string;
  response: string;
  providerId: string;
  projectId: string;
  tokensUsed: number;
  duration: number;
  timestamp: string;
  steps: AgentStep[];
}
