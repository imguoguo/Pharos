import { readdir, readFile, stat } from 'fs/promises';
import { resolve, relative, join, basename } from 'path';
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
  const enabledSources = sources.filter((s) => s.enabled);
  const allowedRoots = enabledSources.map((s) => resolve(s.path));

  const sourceList = enabledSources.map((s) => `- "${s.name}" → ${s.path}`).join('\n');

  const readFileTool: AgentTool = {
    definition: {
      name: 'read_file',
      description: 'Read the contents of a file. Path can be absolute or relative to any knowledge source root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to a source root)' },
          source: { type: 'string', description: 'Source name to resolve relative path against (optional, searches all if omitted)' },
        },
        required: ['path'],
      },
    },
    async execute(args) {
      const roots = args.source
        ? allowedRoots.filter((_, i) => enabledSources[i].name.toLowerCase() === (args.source as string).toLowerCase())
        : allowedRoots;
      const filePath = resolvePath(args.path as string, roots.length > 0 ? roots : allowedRoots);
      if (!isPathAllowed(filePath, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      try {
        const info = await stat(filePath);
        if (info.size > 512 * 1024) {
          return 'Error: file too large (>512KB)';
        }
        return await readFile(filePath, 'utf-8');
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  };

  const listDirTool: AgentTool = {
    definition: {
      name: 'list_directory',
      description: 'List files and directories. Use source name to target a specific knowledge source, or omit to list the first source root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (absolute or relative to source root)' },
          source: { type: 'string', description: 'Source name to resolve against (optional)' },
        },
        required: ['path'],
      },
    },
    async execute(args) {
      const roots = args.source
        ? allowedRoots.filter((_, i) => enabledSources[i].name.toLowerCase() === (args.source as string).toLowerCase())
        : allowedRoots;
      const dirPath = resolvePath(args.path as string, roots.length > 0 ? roots : allowedRoots);
      if (!isPathAllowed(dirPath, allowedRoots)) {
        return 'Error: path is outside allowed knowledge sources';
      }
      try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        return entries
          .map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`)
          .join('\n');
      } catch (err: any) {
        return `Error: ${err.message}`;
      }
    },
  };

  const listSourcesTool: AgentTool = {
    definition: {
      name: 'list_sources',
      description: 'List all available knowledge sources with their names and root paths.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    async execute() {
      return enabledSources.map((s) => `[${s.type}] "${s.name}" → ${s.path}`).join('\n');
    },
  };

  const searchFilesTool: AgentTool = {
    definition: {
      name: 'search_files',
      description: 'Search for files matching a glob pattern. Searches ALL knowledge sources unless a specific source is specified.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts")' },
          source: { type: 'string', description: 'Source name to search in (optional, searches all if omitted)' },
        },
        required: ['pattern'],
      },
    },
    async execute(args) {
      const roots = args.source
        ? allowedRoots.filter((_, i) => enabledSources[i].name.toLowerCase() === (args.source as string).toLowerCase())
        : allowedRoots;
      const searchRoots = roots.length > 0 ? roots : allowedRoots;

      const allResults: string[] = [];
      for (const root of searchRoots) {
        const sourceName = enabledSources[allowedRoots.indexOf(root)]?.name || basename(root);
        const results: string[] = [];
        async function walk(dir: string, depth: number) {
          if (depth > 8 || results.length > 50) return;
          try {
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
          } catch { /* skip inaccessible dirs */ }
        }
        await walk(root, 0);
        for (const r of results) {
          allResults.push(searchRoots.length > 1 ? `[${sourceName}] ${r}` : r);
        }
      }
      return allResults.length > 0 ? allResults.slice(0, 100).join('\n') : 'No files found';
    },
  };

  const grepTool: AgentTool = {
    definition: {
      name: 'grep',
      description: 'Search file contents for a regex pattern. Searches ALL knowledge sources unless a specific source is specified.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          source: { type: 'string', description: 'Source name to search in (optional, searches all if omitted)' },
          path: { type: 'string', description: 'Subdirectory or file to search in (optional)' },
          maxResults: { type: 'number', description: 'Max results to return (default 20)' },
        },
        required: ['pattern'],
      },
    },
    async execute(args) {
      const maxResults = (args.maxResults as number) || 20;
      const roots = args.source
        ? allowedRoots.filter((_, i) => enabledSources[i].name.toLowerCase() === (args.source as string).toLowerCase())
        : allowedRoots;
      const searchRoots = roots.length > 0 ? roots : allowedRoots;

      let regex: RegExp;
      try {
        regex = new RegExp(args.pattern as string, 'gi');
      } catch {
        return `Error: invalid regex pattern`;
      }

      const allResults: string[] = [];

      for (const root of searchRoots) {
        const sourceName = enabledSources[allowedRoots.indexOf(root)]?.name || basename(root);
        const searchPath = args.path ? resolve(root, args.path as string) : root;
        if (!isPathAllowed(searchPath, allowedRoots)) continue;

        async function searchFile(filePath: string) {
          if (allResults.length >= maxResults) return;
          try {
            const info = await stat(filePath);
            if (info.size > 256 * 1024) return;
            const content = await readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && allResults.length < maxResults; i++) {
              if (regex.test(lines[i])) {
                const rel = relative(root, filePath);
                const prefix = searchRoots.length > 1 ? `[${sourceName}] ` : '';
                allResults.push(`${prefix}${rel}:${i + 1}: ${lines[i].trim()}`);
              }
              regex.lastIndex = 0;
            }
          } catch { /* skip unreadable files */ }
        }

        async function walk(dir: string, depth: number) {
          if (depth > 8 || allResults.length >= maxResults) return;
          try {
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
          } catch { /* skip inaccessible dirs */ }
        }

        try {
          const info = await stat(searchPath);
          if (info.isFile()) {
            await searchFile(searchPath);
          } else {
            await walk(searchPath, 0);
          }
        } catch { /* path doesn't exist */ }
      }

      return allResults.length > 0 ? allResults.join('\n') : 'No matches found';
    },
  };

  return [listSourcesTool, readFileTool, listDirTool, searchFilesTool, grepTool];
}

function matchGlob(path: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(path.replace(/\\/g, '/'));
}
