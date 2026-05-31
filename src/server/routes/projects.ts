import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { saveConfig } from '../../config/index.js';
import type { Project, KnowledgeSource } from '../../types/config.js';
import { randomUUID } from 'crypto';

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

  router.put('/:id/sources/:sourceId', (req, res) => {
    const project = ctx.config.projects.find((p) => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const sIdx = project.sources.findIndex((s) => s.id === req.params.sourceId);
    if (sIdx === -1) return res.status(404).json({ error: 'Source not found' });
    project.sources[sIdx] = { ...project.sources[sIdx], ...req.body };
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
