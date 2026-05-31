import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import type { AppConfig, KnowledgeSource, Project } from '../types/config.js';
import { appendLog, getReposDir, saveConfig } from '../config/index.js';
import { generateIndex } from './indexer.js';

interface SyncProgress {
  status: 'idle' | 'syncing' | 'success' | 'error' | 'indexing';
  lines: string[];
  error?: string;
  updatedAt: string;
}

const progressBySource = new Map<string, SyncProgress>();

export function getManagedRepoPath(projectId: string, sourceId: string): string {
  return join(getReposDir(), projectId, sourceId);
}

export function getSyncProgress(sourceId: string): SyncProgress {
  return progressBySource.get(sourceId) ?? {
    status: 'idle',
    lines: [],
    updatedAt: new Date().toISOString(),
  };
}

export function pushSourceLog(sourceId: string, message: string): void {
  pushProgressLines(sourceId, message);
}

export function createGitSource(projectId: string, source: KnowledgeSource): KnowledgeSource {
  return {
    ...source,
    type: 'git-repo',
    path: getManagedRepoPath(projectId, source.id),
    branch: source.branch || 'main',
    syncStatus: 'idle',
    syncIntervalMinutes: source.syncIntervalMinutes || 0,
  };
}

export async function syncGitSource(config: AppConfig, project: Project, source: KnowledgeSource): Promise<void> {
  if (!source.remoteUrl) {
    throw new Error('Git source is missing remoteUrl');
  }
  validateGitUrl(source.remoteUrl);

  const repoPath = getManagedRepoPath(project.id, source.id);
  await mkdir(join(getReposDir(), project.id), { recursive: true });

  source.path = repoPath;
  source.syncStatus = 'syncing';
  source.syncError = undefined;
  setProgress(source.id, 'syncing', [`Starting sync for ${source.remoteUrl}`]);
  saveConfig();

  try {
    if (existsSync(join(repoPath, '.git'))) {
      await runGit(['-C', repoPath, 'pull', '--ff-only'], source.id);
    } else {
      const args = ['clone', '--progress'];
      if (source.branch) {
        args.push('--branch', source.branch);
      }
      args.push(source.remoteUrl, repoPath);
      await runGit(args, source.id);
    }

    const now = new Date().toISOString();
    source.syncStatus = 'success';
    source.lastSyncAt = now;
    source.nextSyncAt = getNextSyncAt(source.syncIntervalMinutes);
    setProgress(source.id, 'success', [`Sync completed at ${now}`]);
    appendLog('info', `Git sync completed: ${project.name}/${source.name}`);

    setProgress(source.id, 'indexing', [...getSyncProgress(source.id).lines, 'Sync done. Generating index...']);
    void generateIndex(config, project, source).then(() => {
      pushProgressLines(source.id, 'Index generation completed.');
      setProgress(source.id, 'success', getSyncProgress(source.id).lines);
    }).catch((err) => {
      pushProgressLines(source.id, `Index generation failed: ${err}`);
      setProgress(source.id, 'success', getSyncProgress(source.id).lines);
      appendLog('warn', `Index generation failed for ${source.name}: ${err}`);
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    source.syncStatus = 'error';
    source.syncError = error;
    source.nextSyncAt = getNextSyncAt(source.syncIntervalMinutes);
    setProgress(source.id, 'error', [`Sync failed: ${error}`], error);
    appendLog('error', `Git sync failed: ${project.name}/${source.name}: ${error}`);
    throw err;
  } finally {
    saveConfig();
  }
}

function validateGitUrl(url: string): void {
  const trimmed = url.trim();
  const valid = /^https:\/\/[^\s]+$/i.test(trimmed)
    || /^ssh:\/\/[^\s]+$/i.test(trimmed)
    || /^git@[^\s:]+:[^\s]+$/i.test(trimmed);

  if (!valid || /[;&|`$<>]/.test(trimmed)) {
    throw new Error('Invalid Git URL');
  }
}

function runGit(args: string[], sourceId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      pushProgressLines(sourceId, text);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(output.trim() || `git exited with code ${code}`));
      }
    });
  });
}

function setProgress(
  sourceId: string,
  status: SyncProgress['status'],
  lines: string[],
  error?: string,
): void {
  progressBySource.set(sourceId, {
    status,
    lines: lines.slice(-80),
    error,
    updatedAt: new Date().toISOString(),
  });
}

function pushProgressLines(sourceId: string, text: string): void {
  const current = getSyncProgress(sourceId);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  progressBySource.set(sourceId, {
    ...current,
    status: 'syncing',
    lines: [...current.lines, ...lines].slice(-80),
    updatedAt: new Date().toISOString(),
  });
}

function getNextSyncAt(intervalMinutes?: number): string | undefined {
  if (!intervalMinutes || intervalMinutes <= 0) return undefined;
  return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
}
