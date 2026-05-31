import { randomUUID } from 'crypto';
import type { AgentTask, AgentStep } from '../types/agent.js';
import type { KnowledgeSource } from '../types/config.js';
import type { Message, ToolResult } from '../types/llm.js';
import { chatWithFallback } from '../llm/index.js';
import { createAgentTools, type AgentTool } from './tools.js';
import { appendLog } from '../config/index.js';

interface AgentExecutorOptions {
  timeout: number;
  maxConcurrency: number;
}

export class AgentExecutor {
  private timeout: number;
  private maxConcurrency: number;
  private running = 0;
  private queue: Array<{
    task: AgentTask;
    sources: KnowledgeSource[];
    resolve: (result: AgentTask) => void;
  }> = [];

  constructor(options: AgentExecutorOptions) {
    this.timeout = options.timeout;
    this.maxConcurrency = options.maxConcurrency;
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
      steps: [],
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
      const result = await this.runAgent(item.task.query, tools, item.task.steps);
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

  private async runAgent(query: string, tools: AgentTool[], steps: AgentStep[]): Promise<string> {
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

      const response = await chatWithFallback(messages, toolDefs);

      steps.push({
        type: 'llm_call',
        timestamp: new Date().toISOString(),
        content: response.content || '(tool calls)',
        providerId: response.providerId,
      });

      if (!response.toolCalls?.length) {
        return response.content;
      }

      messages.push({ role: 'assistant', content: JSON.stringify(response) });

      const results: ToolResult[] = [];
      for (const call of response.toolCalls) {
        steps.push({
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          toolName: call.name,
          toolArgs: call.arguments,
          content: `${call.name}(${JSON.stringify(call.arguments)})`,
        });

        const tool = tools.find((t) => t.definition.name === call.name);
        if (!tool) {
          const errContent = `Unknown tool: ${call.name}`;
          results.push({ id: call.id, content: errContent, error: true });
          steps.push({ type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: errContent });
          continue;
        }
        try {
          const output = await tool.execute(call.arguments);
          results.push({ id: call.id, content: output });
          steps.push({ type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: output.slice(0, 2000) });
        } catch (err) {
          const errContent = `Error: ${err}`;
          results.push({ id: call.id, content: errContent, error: true });
          steps.push({ type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: errContent });
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
You have access to tools that let you read files, search code, list directories, and grep file contents.
Use these tools to thoroughly investigate the question before answering.
Be concise and accurate. Reference specific files and line numbers when relevant.
If you cannot find the answer, say so clearly.
Important: All file paths should be relative to the knowledge source root. Use list_directory first to discover the structure, then read specific files.`;
  }
}
