import { readdir, readFile, stat } from 'fs/promises';
import { resolve, relative, join } from 'path';
import type { KnowledgeSource } from '../types/config.js';
import type { ToolDefinition } from '../types/llm.js';

export interface AgentTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  const resolved = resolve(targetPath);
  return allowedRoots.some((root) => resolved.startsWith(resolve(root)));
}

function resolvePath(inputPath: string, allowedRoots: string[]): string {
  const abs = resolve(inputPath);
  if (allowedRoots.some((root) => abs.startsWith(resolve(root)))) {
    return abs;
  }
  for (const root of allowedRoots) {
    const candidate = resolve(root, inputPath);
    if (candidate.startsWith(resolve(root))) {
      return candidate;
    }
  }
  return abs;
}

export function createAgentTools(sources: KnowledgeSource[]): AgentTool[] {
  const allowedRoots = sources.filter((s) => s.enabled).map((s) => resolve(s.path));

  const readFileTool: AgentTool = {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
        },
        required: ['path'],
      },
    },
    async execute(args) {
      const filePath = resolvePath(args.path as string, allowedRoots);
      if (!isPathAllowed(filePath, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      const info = await stat(filePath);
      if (info.size > 512 * 1024) {
        return 'Error: file too large (>512KB)';
      }
      return readFile(filePath, 'utf-8');
    },
  };

  const listDirTool: AgentTool = {
    definition: {
      name: 'list_directory',
      description: 'List files and directories at the given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
        },
        required: ['path'],
      },
    },
    async execute(args) {
      const dirPath = resolvePath(args.path as string, allowedRoots);
      if (!isPathAllowed(dirPath, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      const entries = await readdir(dirPath, { withFileTypes: true });
      return entries
        .map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`)
        .join('\n');
    },
  };

  const searchFilesTool: AgentTool = {
    definition: {
      name: 'search_files',
      description: 'Search for files matching a glob pattern within knowledge sources',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts")' },
          root: { type: 'string', description: 'Root directory to search in (optional)' },
        },
        required: ['pattern'],
      },
    },
    async execute(args) {
      const root = args.root ? resolvePath(args.root as string, allowedRoots) : allowedRoots[0];
      if (!isPathAllowed(root, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      const results: string[] = [];
      async function walk(dir: string, depth: number) {
        if (depth > 8 || results.length > 100) return;
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          if (entry.isDirectory()) {
            await walk(full, depth + 1);
          } else {
            const rel = relative(root, full);
            if (matchGlob(rel, args.pattern as string)) {
              results.push(rel);
            }
          }
        }
      }
      await walk(root, 0);
      return results.length > 0 ? results.join('\n') : 'No files found';
    },
  };

  const grepTool: AgentTool = {
    definition: {
      name: 'grep',
      description: 'Search file contents for a regex pattern',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory or file to search in' },
          maxResults: { type: 'number', description: 'Max results to return (default 20)' },
        },
        required: ['pattern', 'path'],
      },
    },
    async execute(args) {
      const searchPath = resolvePath(args.path as string, allowedRoots);
      if (!isPathAllowed(searchPath, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      const maxResults = (args.maxResults as number) || 20;
      const results: string[] = [];
      const regex = new RegExp(args.pattern as string, 'gi');

      async function searchFile(filePath: string) {
        if (results.length >= maxResults) return;
        const info = await stat(filePath);
        if (info.size > 256 * 1024) return;
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          if (regex.test(lines[i])) {
            results.push(`${relative(searchPath, filePath)}:${i + 1}: ${lines[i].trim()}`);
          }
          regex.lastIndex = 0;
        }
      }

      async function walk(dir: string, depth: number) {
        if (depth > 8 || results.length >= maxResults) return;
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full, depth + 1);
          } else {
            await searchFile(full);
          }
        }
      }

      const info = await stat(searchPath);
      if (info.isFile()) {
        await searchFile(searchPath);
      } else {
        await walk(searchPath, 0);
      }
      return results.length > 0 ? results.join('\n') : 'No matches found';
    },
  };

  return [readFileTool, listDirTool, searchFilesTool, grepTool];
}

function matchGlob(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(path.replace(/\\/g, '/'));
}
