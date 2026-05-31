import { Router } from 'express';
import { resolve, join } from 'path';
import { mkdirSync } from 'fs';
import multer from 'multer';
import type { ServerContext } from '../index.js';
import { saveConfig } from '../../config/index.js';
import type { Project, KnowledgeSource } from '../../types/config.js';
import { createGitSource, getSyncProgress, syncGitSource } from '../../services/git.js';
import { scheduleSource } from '../../services/scheduler.js';
import { generateIndex, readIndex, writeIndex } from '../../services/indexer.js';
import { randomUUID } from 'crypto';

const UPLOADS_DIR = resolve(process.cwd(), 'data', 'uploads');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const projectId = req.params.id;
    const keepStructure = req.query.keepStructure !== 'false';
    const relPath = (file as any).webkitRelativePath || file.originalname;
    const relDir = keepStructure
      ? join(UPLOADS_DIR, projectId, relPath.split('/').slice(0, -1).join('/'))
      : join(UPLOADS_DIR, projectId);
    mkdirSync(relDir, { recursive: true });
    cb(null, relDir);
  },
  filename(_req, file, cb) {
    const relPath = (file as any).webkitRelativePath || file.originalname;
    cb(null, relPath.split('/').pop() || file.originalname);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

export function createProjectsRouter(ctx: ServerContext): Router {
  const router = Router();

  // --- collection routes (no :id param) ---
  router.get('/', (_req, res) => {
    res.json(ctx.config.projects);
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

  // --- source sub-routes (specific paths before :sourceId param) ---
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

  router.post('/:id/sources/upload', upload.array('files', 500), (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ error: 'No files uploaded' });

    const folderName = req.body.name || files[0].originalname.split('/')[0] || 'upload';
    const basePath = join(UPLOADS_DIR, req.params.id).replace(/\\/g, '/');

    const source: KnowledgeSource = {
      id: randomUUID(),
      name: folderName,
      type: 'directory',
      path: basePath,
      enabled: true,
    };
    project.sources.push(source);
    project.updatedAt = new Date().toISOString();
    saveConfig();
    res.status(201).json({ source, fileCount: files.length });
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

  router.get('/:id/sources/:sourceId/index', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = project.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    const content = readIndex(source);
    res.json({ content: content || '', lastIndexedAt: source.lastIndexedAt || null });
  });

  router.put('/:id/sources/:sourceId/index', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = project.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    writeIndex(source, req.body.content || '');
    source.lastIndexedAt = new Date().toISOString();
    saveConfig();
    res.json({ success: true });
  });

  router.post('/:id/sources/:sourceId/reindex', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = project.sources.find((s) => s.id === req.params.sourceId);
    if (!source) return res.status(404).json({ error: 'Source not found' });
    void generateIndex(ctx.config, project, source).catch(() => undefined);
    res.status(202).json({ message: 'Indexing started' });
  });

  // --- source CRUD ---
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

  // --- project CRUD (param routes last to avoid shadowing) ---
  router.get('/:id', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
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

  return router;
}
