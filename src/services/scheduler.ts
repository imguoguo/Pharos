import type { AppConfig, KnowledgeSource, Project } from '../types/config.js';
import { appendLog, saveConfig } from '../config/index.js';
import { syncGitSource } from './git.js';

const timers = new Map<string, NodeJS.Timeout>();

export function refreshSchedules(config: AppConfig): void {
  for (const timer of timers.values()) {
    clearInterval(timer);
  }
  timers.clear();

  for (const project of config.projects) {
    for (const source of project.sources) {
      if (source.type !== 'git-repo') continue;
      if (!source.syncIntervalMinutes || source.syncIntervalMinutes <= 0) continue;

      const intervalMs = source.syncIntervalMinutes * 60 * 1000;
      source.nextSyncAt = new Date(Date.now() + intervalMs).toISOString();
      const timer = setInterval(() => {
        void syncScheduledSource(config, project.id, source.id);
      }, intervalMs);
      timers.set(source.id, timer);
    }
  }
  saveConfig();
}

export async function syncScheduledSource(
  config: AppConfig,
  projectId: string,
  sourceId: string,
): Promise<void> {
  const project = config.projects.find((p) => p.id === projectId);
  const source = project?.sources.find((s) => s.id === sourceId);
  if (!project || !source) return;
  if (source.syncStatus === 'syncing') return;

  try {
    appendLog('info', `Scheduled git sync: ${project.name}/${source.name}`);
    await syncGitSource(config, project, source);
  } catch {
    // syncGitSource already records persistent state and logs.
  }
}

export function scheduleSource(config: AppConfig, project: Project, source: KnowledgeSource): void {
  if (timers.has(source.id)) {
    clearInterval(timers.get(source.id));
    timers.delete(source.id);
  }
  if (!source.syncIntervalMinutes || source.syncIntervalMinutes <= 0) {
    source.nextSyncAt = undefined;
    saveConfig();
    return;
  }

  const intervalMs = source.syncIntervalMinutes * 60 * 1000;
  source.nextSyncAt = new Date(Date.now() + intervalMs).toISOString();
  const timer = setInterval(() => {
    void syncScheduledSource(config, project.id, source.id);
  }, intervalMs);
  timers.set(source.id, timer);
  saveConfig();
}
