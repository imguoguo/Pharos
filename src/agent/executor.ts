import { randomUUID } from 'crypto';
import type { AgentTask, AgentStep } from '../types/agent.js';
import type { KnowledgeSource, ProgressVerbosity } from '../types/config.js';
import type { Message, ToolResult } from '../types/llm.js';
import { chatWithFallback } from '../llm/index.js';
import { createAgentTools, type AgentTool } from './tools.js';
import { appendLog } from '../config/index.js';

export type StepCallback = (step: AgentStep) => void;

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
    onStep?: StepCallback;
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
    onStep?: StepCallback,
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
      this.queue.push({ task, sources, onStep, resolve });
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
      const result = await this.runAgent(item.task.query, tools, item.task.steps, item.onStep);
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

  private async runAgent(query: string, tools: AgentTool[], steps: AgentStep[], onStep?: StepCallback): Promise<string> {
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

      const llmStep: AgentStep = {
        type: 'llm_call',
        timestamp: new Date().toISOString(),
        content: response.content || '(tool calls)',
        providerId: response.providerId,
      };
      steps.push(llmStep);
      onStep?.(llmStep);

      if (!response.toolCalls?.length) {
        return response.content;
      }

      messages.push({ role: 'assistant', content: response.content || '' });

      const results: ToolResult[] = [];
      for (const call of response.toolCalls) {
        const callStep: AgentStep = {
          type: 'tool_call',
          timestamp: new Date().toISOString(),
          toolName: call.name,
          toolArgs: call.arguments,
          content: `${call.name}(${JSON.stringify(call.arguments)})`,
        };
        steps.push(callStep);
        onStep?.(callStep);

        const tool = tools.find((t) => t.definition.name === call.name);
        if (!tool) {
          const errContent = `Unknown tool: ${call.name}`;
          results.push({ id: call.id, content: errContent, error: true });
          const errStep: AgentStep = { type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: errContent };
          steps.push(errStep);
          onStep?.(errStep);
          continue;
        }
        try {
          const output = await tool.execute(call.arguments);
          results.push({ id: call.id, content: output });
          const resultStep: AgentStep = { type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: output.slice(0, 2000) };
          steps.push(resultStep);
          onStep?.(resultStep);
        } catch (err) {
          const errContent = `Error: ${err}`;
          results.push({ id: call.id, content: errContent, error: true });
          const errStep: AgentStep = { type: 'tool_result', timestamp: new Date().toISOString(), toolName: call.name, content: errContent };
          steps.push(errStep);
          onStep?.(errStep);
        }
      }

      messages.push({
        role: 'user',
        content: results.map((r) => `[Tool ${r.id}]: ${r.content}`).join('\n\n'),
      });
    }

    return 'I explored the available sources but was unable to formulate a complete answer within the iteration limit.';
  }

  private buildSystemPrompt(): string {
    return `You are Pharos, an AI assistant that explores codebases and knowledge sources to answer questions.
You have access to tools that let you read files, search code, list directories, and grep file contents.
Use these tools to thoroughly investigate the question before answering.
Be concise and accurate. Reference specific files and line numbers when relevant.
If you cannot find the answer, say so clearly.
Important: All file paths should be relative to the knowledge source root. Use list_directory first to discover the structure, then read specific files.

Formatting rules for Discord:
- Do NOT use --- or ___ horizontal rules (Discord does not support them)
- Use ## headers to separate sections instead
- Keep code blocks short. If content is long, summarize key parts and reference file paths
- Never leave a code block unclosed`;
  }
}
