import type { AppConfig, Project } from '../types/config.js';
import { saveConfig } from '../config/index.js';
import { createGitSource, syncGitSource } from '../services/git.js';
import { scheduleSource } from '../services/scheduler.js';
import { randomUUID } from 'crypto';

export interface CommandResult {
  reply: string;
}

function isAdmin(userId: string, roleIds: string[], config: AppConfig): boolean {
  if (!config.discord.adminRoles.length) return false;
  return config.discord.adminRoles.some((r) => r === userId || roleIds.includes(r));
}

function findProject(config: AppConfig, nameOrId: string): Project | undefined {
  const lower = nameOrId.toLowerCase();
  return config.projects.find(
    (p) => p.id === nameOrId || p.name.toLowerCase() === lower,
  );
}

export async function handleAdminCommand(
  raw: string,
  userId: string,
  roleIds: string[],
  channelId: string,
  guildId: string,
  isDM: boolean,
  config: AppConfig,
): Promise<CommandResult | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const rawCmd = parts[0].toLowerCase();
  const cmd = rawCmd.startsWith('/') ? rawCmd.slice(1) : rawCmd;

  if (cmd === 'help') {
    const admin = isAdmin(userId, roleIds, config) || isDM;

    if (admin) {
      return {
        reply: [
          '**Pharos Admin Commands**',
          '`help` — show this list',
          '`project create <name>` — create a new project',
          '`project list` — list all projects',
          '`project bind <project>` — bind current channel to project',
          '`project unbind <project>` — unbind current channel from project',
          '`repo add <project> <git-url> [branch] [interval-minutes]` — add & clone a Git repository',
          '`repo sync <project> <source-name>` — manually pull a Git source',
          '`source add <project> <path>` — add a local directory/file source',
          '`source list <project>` — list sources in a project',
        ].join('\n'),
      };
    }

    const project = config.projects.find((p) => p.channels.includes(channelId));
    const projectInfo = project
      ? `Currently linked to project **${project.name}**${project.sources.length > 0 ? ` (${project.sources.length} knowledge sources)` : ''}.`
      : 'This channel is not linked to any project yet.';

    return {
      reply: [
        '**Pharos** — Intelligent Codebase Assistant',
        '',
        'I can explore code repositories, documentation, and knowledge sources to answer your technical questions.',
        '',
        'Just @mention me with your question and I will investigate the linked project to find the answer.',
        '',
        projectInfo,
      ].join('\n'),
    };
  }

  if (!isAdmin(userId, roleIds, config) && !isDM) {
    return null;
  }

  if (cmd === 'project') {
    const sub = parts[1]?.toLowerCase();

    if (sub === 'create') {
      const name = parts.slice(2).join(' ');
      if (!name) return { reply: 'Usage: `project create <name>`' };
      const project: Project = {
        id: randomUUID(),
        name,
        description: '',
        sources: [],
        channels: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      config.projects.push(project);
      saveConfig();
      return { reply: `Project **${name}** created (ID: \`${project.id}\`)` };
    }

    if (sub === 'list') {
      if (!config.projects.length) return { reply: 'No projects yet.' };
      const lines = config.projects.map((p) => `• **${p.name}** — ${p.sources.length} sources, ${p.channels.length} channels`);
      return { reply: lines.join('\n') };
    }

    if (sub === 'bind') {
      const project = findProject(config, parts.slice(2).join(' '));
      if (!project) return { reply: 'Project not found.' };
      if (!project.channels.includes(channelId)) {
        project.channels.push(channelId);
        project.updatedAt = new Date().toISOString();
        saveConfig();
      }
      return { reply: `Channel bound to **${project.name}**. Questions here will now use this project's knowledge sources.` };
    }

    if (sub === 'unbind') {
      const project = findProject(config, parts.slice(2).join(' '));
      if (!project) return { reply: 'Project not found.' };
      project.channels = project.channels.filter((c) => c !== channelId);
      project.updatedAt = new Date().toISOString();
      saveConfig();
      return { reply: `Channel unbound from **${project.name}**.` };
    }
  }

  if (cmd === 'repo') {
    const sub = parts[1]?.toLowerCase();

    if (sub === 'add') {
      const projectName = parts[2];
      const remoteUrl = parts[3];
      const branch = parts[4] || 'main';
      const intervalMinutes = Number(parts[5]) || 0;
      if (!projectName || !remoteUrl) {
        return { reply: 'Usage: `repo add <project> <git-url> [branch] [interval-minutes]`' };
      }
      const project = findProject(config, projectName);
      if (!project) return { reply: `Project **${projectName}** not found.` };

      const source = createGitSource(project.id, {
        id: randomUUID(),
        name: remoteUrl.split('/').pop()?.replace('.git', '') || remoteUrl,
        type: 'git-repo',
        path: '',
        remoteUrl,
        branch,
        syncIntervalMinutes: intervalMinutes,
        enabled: true,
      });
      project.sources.push(source);
      project.updatedAt = new Date().toISOString();
      scheduleSource(config, project, source);
      saveConfig();

      void syncGitSource(config, project, source).catch(() => undefined);
      return { reply: `Cloning \`${remoteUrl}\` (branch: ${branch}) into **${project.name}**. Use \`repo sync\` to check status.` };
    }

    if (sub === 'sync') {
      const project = findProject(config, parts[2] || '');
      if (!project) return { reply: 'Project not found.' };
      const sourceName = parts.slice(3).join(' ');
      const source = project.sources.find(
        (s) => s.type === 'git-repo' && (s.name.toLowerCase() === sourceName.toLowerCase() || !sourceName),
      );
      if (!source) return { reply: 'Git source not found in that project.' };
      void syncGitSource(config, project, source).catch(() => undefined);
      return { reply: `Syncing **${source.name}**…` };
    }
  }

  if (cmd === 'source') {
    const sub = parts[1]?.toLowerCase();

    if (sub === 'add') {
      const project = findProject(config, parts[2] || '');
      if (!project) return { reply: 'Project not found.' };
      const path = parts.slice(3).join(' ');
      if (!path) return { reply: 'Usage: `source add <project> <path>`' };
      const source = {
        id: randomUUID(),
        name: path.split(/[/\\]/).pop() || path,
        type: 'directory' as const,
        path,
        enabled: true,
      };
      project.sources.push(source);
      project.updatedAt = new Date().toISOString();
      saveConfig();
      return { reply: `Source \`${path}\` added to **${project.name}**.` };
    }

    if (sub === 'list') {
      const project = findProject(config, parts.slice(2).join(' '));
      if (!project) return { reply: 'Project not found.' };
      if (!project.sources.length) return { reply: `No sources in **${project.name}**.` };
      const lines = project.sources.map(
        (s) => `• **${s.name}** [${s.type}]${s.syncStatus ? ` — ${s.syncStatus}` : ''}`,
      );
      return { reply: lines.join('\n') };
    }
  }

  return null;
}
