import { Router } from 'express';
import { resolve, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import type { ServerContext } from '../index.js';
import { saveConfig } from '../../config/index.js';
import type { Project, KnowledgeSource } from '../../types/config.js';
import { createGitSource, getSyncProgress, syncGitSource } from '../../services/git.js';
import { scheduleSource } from '../../services/scheduler.js';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = resolve(process.cwd(), 'data', 'uploads');

function ensureUploadsDir(projectId: string): string {
  const dir = join(UPLOADS_DIR, projectId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const projectId = _req.params.id;
    const dir = ensureUploadsDir(projectId);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = file.originalname.split('.').pop();
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export function createProjectsRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(ctx.config.projects);
  });

  router.get('/:id', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  });

  router.post('/', (req, res) => {
    const { name, description } = req.body;
    const project: Project = {
      id: randomUUID(),
      name,
      description: description || '',
      sources: [],
      channels: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ctx.config.projects.push(project);
    saveConfig();
    res.status(201).json(project);
  });

  router.put('/:id', (req, res) => {
    const idx = ctx.config.projects.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const { name, description, channels } = req.body;
    if (name !== undefined) ctx.config.projects[idx].name = name;
    if (description !== undefined) ctx.config.projects[idx].description = description;
    if (channels !== undefined) ctx.config.projects[idx].channels = channels;
    ctx.config.projects[idx].updatedAt = new Date().toISOString();
    saveConfig();
    res.json(ctx.config.projects[idx]);
  });

  router.delete('/:id', (req, res) => {
    const idx = ctx.config.projects.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    ctx.config.projects.splice(idx, 1);
    saveConfig();
    res.status(204).end();
  });

  router.get('/:id/sources', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project.sources);
  });

  router.post('/:id/sources', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    const source: KnowledgeSource = {
      id: randomUUID(),
      name: req.body.name,
      type: req.body.type,
      path: req.body.path,
      include: req.body.include,
      exclude: req.body.exclude,
      enabled: true,
    };
    project.sources.push(source);
    project.updatedAt = new Date().toISOString();
    saveConfig();
    res.status(201).json(source);
  });

  router.post('/:id/sources/git', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const source = createGitSource(project.id, {
      id: randomUUID(),
      name: req.body.name || req.body.remoteUrl,
      type: 'git-repo',
      path: '',
      remoteUrl: req.body.remoteUrl,
      branch: req.body.branch || 'main',
      syncIntervalMinutes: Number(req.body.syncIntervalMinutes) || 0,
      enabled: true,
    });

    project.sources.push(source);
    project.updatedAt = new Date().toISOString();
    scheduleSource(ctx.config, project, source);
    saveConfig();

    void syncGitSource(ctx.config, project, source).catch(() => undefined);
    res.status(202).json(source);
  });

  router.post('/:id/sources/upload', upload.single('file'), (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const source: KnowledgeSource = {
      id: randomUUID(),
      name: req.body.name || req.file.originalname,
      type: 'file',
      path: req.file.path.replace(/\\/g, '/'),
      enabled: true,
    };
    project.sources.push(source);
    project.updatedAt = new Date().toISOString();
    saveConfig();
    res.status(201).json(source);
  });

  router.get('/:id/sources/:sourceId/progress', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = project.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    res.json({ source, progress: getSyncProgress(source.id) });
  });

  router.post('/:id/sources/:sourceId/sync', async (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = project.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    if (source.type !== 'git-repo') return res.status(400).json({ error: 'Source is not a Git repository' });

    void syncGitSource(ctx.config, project, source).catch(() => undefined);
    res.status(202).json(source);
  });

  router.put('/:id/sources/:sourceId', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const sIdx = project.sources.findIndex((s) => s.id === req.params.sourceId);
    if (sIdx === -1) return res.status(404).json({ error: 'Source not found' });
    project.sources[sIdx] = { ...project.sources[sIdx], ...req.body };
    if (project.sources[sIdx].type === 'git-repo') {
      scheduleSource(ctx.config, project, project.sources[sIdx]);
    }
    project.updatedAt = new Date().toISOString();
    saveConfig();
    res.json(project.sources[sIdx]);
  });

  router.delete('/:id/sources/:sourceId', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const sIdx = project.sources.findIndex((s) => s.id === req.params.sourceId);
    if (sIdx === -1) return res.status(404).json({ error: 'Source not found' });
    project.sources.splice(sIdx, 1);
    project.updatedAt = new Date().toISOString();
    saveConfig();
    res.status(204).end();
  });

  return router;
}
