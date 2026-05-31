import { readdir, readFile, stat } from 'fs/promises';
import { resolve, relative, join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { KnowledgeSource } from '../types/config.js';
import type { ToolDefinition } from '../types/llm.js';

const execFileAsync = promisify(execFile);

export interface AgentTool {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  const resolved = resolve(targetPath);
  return allowedRoots.some((root) => resolved.startsWith(resolve(root)));
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
      const filePath = resolve(args.path as string);
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
      const dirPath = resolve(args.path as string);
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
      const root = args.root ? resolve(args.root as string) : allowedRoots[0];
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
      const searchPath = resolve(args.path as string);
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

  const execCommandTool: AgentTool = {
    definition: {
      name: 'exec_command',
      description: 'Execute a shell command in the sandbox (read-only operations, tests, builds)',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
    async execute(args) {
      const cwd = args.cwd ? resolve(args.cwd as string) : allowedRoots[0];
      if (!isPathAllowed(cwd, allowedRoots)) {
        return 'Error: working directory is outside allowed knowledge sources';
      }
      const blocked = ['rm -rf', 'rmdir', 'del ', 'format ', 'mkfs'];
      const cmd = args.command as string;
      if (blocked.some((b) => cmd.toLowerCase().includes(b))) {
        return 'Error: destructive commands are not allowed';
      }
      try {
        const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
          cwd,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        });
        const output = (stdout + (stderr ? `\n[stderr]: ${stderr}` : '')).trim();
        return output.slice(0, 8000) || '(no output)';
      } catch (err: unknown) {
        const error = err as { message: string };
        return `Error: ${error.message}`.slice(0, 2000);
      }
    },
  };

  return [readFileTool, listDirTool, searchFilesTool, grepTool, execCommandTool];
}

function matchGlob(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(path.replace(/\\/g, '/'));
}
