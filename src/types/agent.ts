export interface AgentTask {
  id: string;
  query: string;
  channelId: string;
  userId: string;
  messageId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ConversationEntry {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  query: string;
  response: string;
  providerId: string;
  tokensUsed: number;
  duration: number;
  timestamp: Date;
}
