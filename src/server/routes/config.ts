import { Router } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ServerContext } from '../index.js';

const CONFIG_PATH = resolve(process.cwd(), 'config.json');

export function createConfigRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/discord', (_req, res) => {
    res.json({
      clientId: ctx.config.discord.clientId,
      allowedChannels: ctx.config.discord.allowedChannels,
      adminRoles: ctx.config.discord.adminRoles,
      token: ctx.config.discord.token ? '***' : '',
    });
  });

  router.put('/discord', (req, res) => {
    const { token, clientId, allowedChannels, adminRoles } = req.body;
    if (token && token !== '***') ctx.config.discord.token = token;
    if (clientId !== undefined) ctx.config.discord.clientId = clientId;
    if (allowedChannels !== undefined) ctx.config.discord.allowedChannels = allowedChannels;
    if (adminRoles !== undefined) ctx.config.discord.adminRoles = adminRoles;
    res.json({ success: true });
  });

  router.put('/agent', (req, res) => {
    const { timeout, maxConcurrency, sandbox } = req.body;
    if (timeout !== undefined) ctx.config.agent.timeout = timeout;
    if (maxConcurrency !== undefined) ctx.config.agent.maxConcurrency = maxConcurrency;
    if (sandbox !== undefined) ctx.config.agent.sandbox = { ...ctx.config.agent.sandbox, ...sandbox };
    res.json({ success: true });
  });

  router.post('/save', (_req, res) => {
    try {
      writeFileSync(CONFIG_PATH, JSON.stringify(ctx.config, null, 2), 'utf-8');
      res.json({ success: true });
    } catch (err: unknown) {
      const error = err as Error;
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
