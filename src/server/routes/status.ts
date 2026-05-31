import { Router } from 'express';
import type { ServerContext } from '../index.js';

export function createStatusRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const botStatus = ctx.bot.getStatus();
    const enabledProviders = ctx.config.llm.providers.filter((p) => p.enabled);
    res.json({
      bot: botStatus,
      agent: {
        timeout: ctx.config.agent.timeout,
        maxConcurrency: ctx.config.agent.maxConcurrency,
        maxIterations: ctx.config.agent.maxIterations || 20,
        sandbox: ctx.config.agent.sandbox.enabled,
        progressVerbosity: ctx.config.agent.progressVerbosity || 'progress',
      },
      projects: {
        total: ctx.config.projects.length,
      },
      providers: {
        total: ctx.config.llm.providers.length,
        enabled: enabledProviders.length,
      },
    });
  });

  return router;
}
