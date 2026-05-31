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
}
