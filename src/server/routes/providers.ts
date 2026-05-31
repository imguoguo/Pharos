import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { createProvider, initProviders } from '../../llm/index.js';

export function createProvidersRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const providers = ctx.config.llm.providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? '***' : '',
    }));
    res.json({ providers, defaultProvider: ctx.config.llm.defaultProvider });
  });

  router.post('/', (req, res) => {
    const provider = req.body;
    provider.id = crypto.randomUUID();
    ctx.config.llm.providers.push(provider);
    initProviders(ctx.config.llm.providers);
    res.status(201).json({ ...provider, apiKey: '***' });
  });

  router.put('/:id', (req, res) => {
    const idx = ctx.config.llm.providers.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const existing = ctx.config.llm.providers[idx];
    if (req.body.apiKey === '***') {
      req.body.apiKey = existing.apiKey;
    }
    ctx.config.llm.providers[idx] = { ...existing, ...req.body };
    initProviders(ctx.config.llm.providers);
    res.json({ ...ctx.config.llm.providers[idx], apiKey: '***' });
  });

  router.delete('/:id', (req, res) => {
    const idx = ctx.config.llm.providers.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    ctx.config.llm.providers.splice(idx, 1);
    initProviders(ctx.config.llm.providers);
    res.status(204).end();
  });

  router.put('/default', (req, res) => {
    const { providerId } = req.body;
    if (!ctx.config.llm.providers.find((p) => p.id === providerId)) {
      return res.status(400).json({ error: 'Provider not found' });
    }
    ctx.config.llm.defaultProvider = providerId;
    res.json({ defaultProvider: providerId });
  });

  router.post('/:id/test', async (req, res) => {
    const config = ctx.config.llm.providers.find((p) => p.id === req.params.id);
    if (!config) return res.status(404).json({ error: 'Not found' });
    try {
      const provider = createProvider(config);
      const response = await provider.chat([{ role: 'user', content: 'Say "ok"' }]);
      res.json({ success: true, response: response.content });
    } catch (err: unknown) {
      const error = err as Error;
      res.json({ success: false, error: error.message });
    }
  });

  return router;
}
