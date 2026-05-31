import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { saveConfig } from '../../config/index.js';

export function createConfigRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/discord', (_req, res) => {
    res.json({
      clientId: ctx.config.discord.clientId,
      adminRoles: ctx.config.discord.adminRoles,
      token: ctx.config.discord.token ? '***' : '',
    });
  });

  router.put('/discord', (req, res) => {
    const { token, clientId, adminRoles } = req.body;
    if (token && token !== '***') ctx.config.discord.token = token;
    if (clientId !== undefined) ctx.config.discord.clientId = clientId;
    if (adminRoles !== undefined) ctx.config.discord.adminRoles = adminRoles;
    saveConfig();
    res.json({ success: true });
  });

  router.put('/agent', (req, res) => {
    const { timeout, maxConcurrency, sandbox } = req.body;
    if (timeout !== undefined) ctx.config.agent.timeout = timeout;
    if (maxConcurrency !== undefined) ctx.config.agent.maxConcurrency = maxConcurrency;
    if (sandbox !== undefined) ctx.config.agent.sandbox = { ...ctx.config.agent.sandbox, ...sandbox };
    saveConfig();
    res.json({ success: true });
  });

  router.put('/auth', (req, res) => {
    const { password } = req.body;
    if (password) {
      ctx.config.auth.password = password;
      saveConfig();
    }
    res.json({ success: true });
  });

  return router;
}
