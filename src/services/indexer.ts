import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { AppConfig, KnowledgeSource, Project } from '../types/config.js';
import { chatWithFallback } from '../llm/index.js';
import { createAgentTools } from '../agent/tools.js';
import { appendLog, saveConfig } from '../config/index.js';
import type { Message } from '../types/llm.js';

const INDEX_FILENAME = '.pharos-index.md';

export function getIndexPath(source: KnowledgeSource): string {
  const parentDir = dirname(source.path);
  return join(parentDir, `${source.id}-index.md`);
}

export function readIndex(source: KnowledgeSource): string | null {
  const path = getIndexPath(source);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function writeIndex(source: KnowledgeSource, content: string): void {
  const path = getIndexPath(source);
  writeFileSync(path, content, 'utf-8');
}

export async function generateIndex(config: AppConfig, project: Project, source: KnowledgeSource): Promise<string> {
  const tools = createAgentTools([source]);
  const toolDefs = tools.map((t) => t.definition);

  const existingIndex = readIndex(source);
  const existingContext = existingIndex
    ? `\n\nHere is the existing index to update (preserve useful info, add new findings, remove outdated info):\n\`\`\`\n${existingIndex.slice(0, 4000)}\n\`\`\``
    : '';

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are an indexing agent. Your job is to explore a codebase and produce a structured index document in Markdown.

The index should include:
- Project name and brief description
- Tech stack and languages used
- Directory structure overview (top 2 levels)
- Key files and their purposes
- Main entry points
- Configuration files and their roles
- Important modules/packages and what they do
- API endpoints (if applicable)
- Build/run commands (if found in README, Makefile, package.json, etc.)

Keep it concise but comprehensive. Use bullet points. No horizontal rules.
Output ONLY the markdown index content, nothing else.${existingContext}`,
    },
    {
      role: 'user',
      content: `Explore the knowledge source "${source.name}" and generate a structured index. Start by listing the root directory, then investigate key files like README, package.json, go.mod, Cargo.toml, etc.`,
    },
  ];

  const maxRounds = 15;
  for (let i = 0; i < maxRounds; i++) {
    const response = await chatWithFallback(messages, toolDefs);

    if (!response.toolCalls?.length) {
      const indexContent = response.content;
      writeIndex(source, indexContent);
      source.lastIndexedAt = new Date().toISOString();
      saveConfig();
      appendLog('info', `Index generated for ${project.name}/${source.name}`);
      return indexContent;
    }

    messages.push({ role: 'assistant', content: response.content || '' });

    const results: string[] = [];
    for (const call of response.toolCalls) {
      const tool = tools.find((t) => t.definition.name === call.name);
      if (!tool) {
        results.push(`[Tool ${call.id}]: Unknown tool: ${call.name}`);
        continue;
      }
      try {
        const output = await tool.execute(call.arguments);
        results.push(`[Tool ${call.id}]: ${output}`);
      } catch (err) {
        results.push(`[Tool ${call.id}]: Error: ${err}`);
      }
    }

    messages.push({ role: 'user', content: results.join('\n\n') });
  }

  return 'Index generation reached iteration limit.';
}
