import { Router } from 'express';
import type { ServerContext } from '../index.js';

export function createKnowledgeRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(ctx.config.knowledge.sources);
  });

  router.post('/', (req, res) => {
    const source = req.body;
    source.id = crypto.randomUUID();
    source.enabled = true;
    ctx.config.knowledge.sources.push(source);
    res.status(201).json(source);
  });

  router.put('/:id', (req, res) => {
    const idx = ctx.config.knowledge.sources.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    ctx.config.knowledge.sources[idx] = { ...ctx.config.knowledge.sources[idx], ...req.body };
    res.json(ctx.config.knowledge.sources[idx]);
  });

  router.delete('/:id', (req, res) => {
    const idx = ctx.config.knowledge.sources.findIndex((s) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    ctx.config.knowledge.sources.splice(idx, 1);
    res.status(204).end();
  });

  return router;
}
