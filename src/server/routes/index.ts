import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { createProjectsRouter } from './projects.js';
import { createProvidersRouter } from './providers.js';
import { createStatusRouter } from './status.js';
import { createConfigRouter } from './config.js';
import { createHistoryRouter } from './history.js';
import { createAuthRouter } from './auth.js';
import { createBotRouter } from './bot.js';

export function createApiRouter(ctx: ServerContext): Router {
  const router = Router();

  router.use('/auth', createAuthRouter(ctx));
  router.use('/bot', createBotRouter(ctx));
  router.use('/projects', createProjectsRouter(ctx));
  router.use('/providers', createProvidersRouter(ctx));
  router.use('/status', createStatusRouter(ctx));
  router.use('/config', createConfigRouter(ctx));
  router.use('/history', createHistoryRouter(ctx));

  return router;
}
