import { randomUUID } from 'crypto';
import type { AgentTask } from '../types/agent.js';
import type { KnowledgeSource } from '../types/config.js';
import type { LLMProvider, Message, ToolResult } from '../types/llm.js';
import { createAgentTools, type AgentTool } from './tools.js';
import { appendLog } from '../config/index.js';

interface AgentExecutorOptions {
  provider: LLMProvider;
  sources: KnowledgeSource[];
  timeout: number;
  maxConcurrency: number;
}

export class AgentExecutor {
  private provider: LLMProvider;
  private tools: AgentTool[];
  private timeout: number;
  private maxConcurrency: number;
  private running = 0;
  private queue: Array<{
    task: AgentTask;
    sources: KnowledgeSource[];
    resolve: (result: AgentTask) => void;
  }> = [];

  constructor(options: AgentExecutorOptions) {
    this.provider = options.provider;
    this.tools = createAgentTools(options.sources);
    this.timeout = options.timeout;
    this.maxConcurrency = options.maxConcurrency;
  }

  updateProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  async execute(
    query: string,
    channelId: string,
    userId: string,
    messageId: string,
    projectId: string,
    sources: KnowledgeSource[],
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: randomUUID(),
      query,
      channelId,
      userId,
      messageId,
      projectId,
      status: 'pending',
    };

    return new Promise((resolve) => {
      this.queue.push({ task, sources, resolve });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.running >= this.maxConcurrency || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.running++;
    item.task.status = 'running';
    item.task.startedAt = new Date().toISOString();

    try {
      const tools = createAgentTools(item.sources);
      const result = await this.runAgent(item.task.query, tools);
      item.task.status = 'completed';
      item.task.result = result;
      item.task.completedAt = new Date().toISOString();
    } catch (err) {
      item.task.status = 'failed';
      item.task.error = err instanceof Error ? err.message : String(err);
      item.task.completedAt = new Date().toISOString();
      appendLog('error', `Agent task failed: ${item.task.error}`);
    } finally {
      this.running--;
      item.resolve(item.task);
      this.processQueue();
    }
  }

  private async runAgent(query: string, tools: AgentTool[]): Promise<string> {
    const systemPrompt = this.buildSystemPrompt();
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];

    const toolDefs = tools.map((t) => t.definition);
    const startTime = Date.now();
    const maxIterations = 10;

    for (let i = 0; i < maxIterations; i++) {
      if (Date.now() - startTime > this.timeout) {
        return 'The query timed out. Here is what I found so far based on my exploration.';
      }

      if (!this.provider) {
        return 'No LLM provider configured. Please set up a provider in the web panel.';
      }

      const response = await this.provider.chat(messages, toolDefs);

      if (!response.toolCalls?.length) {
        return response.content;
      }

      messages.push({ role: 'assistant', content: JSON.stringify(response) });

      const results: ToolResult[] = [];
      for (const call of response.toolCalls) {
        const tool = tools.find((t) => t.definition.name === call.name);
        if (!tool) {
          results.push({ id: call.id, content: `Unknown tool: ${call.name}`, error: true });
          continue;
        }
        try {
          const output = await tool.execute(call.arguments);
          results.push({ id: call.id, content: output });
        } catch (err) {
          results.push({ id: call.id, content: `Error: ${err}`, error: true });
        }
      }

      messages.push({
        role: 'user',
        content: results.map((r) => `[Tool ${r.id}]: ${r.content}`).join('\n\n'),
      });
    }

    return messages[messages.length - 1]?.content ?? 'Unable to determine an answer.';
  }

  private buildSystemPrompt(): string {
    return `You are Pharos, an AI assistant that explores codebases and knowledge sources to answer questions.
You have access to tools that let you read files, search code, list directories, and execute commands.
Use these tools to thoroughly investigate the question before answering.
Be concise and accurate. Reference specific files and line numbers when relevant.
If you cannot find the answer, say so clearly.`;
  }
}
