import { Router } from 'express';
import type { ServerContext } from '../index.js';

export function createStatusRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const botStatus = ctx.bot.getStatus();
    res.json({
      bot: botStatus,
      agent: {
        timeout: ctx.config.agent.timeout,
        maxConcurrency: ctx.config.agent.maxConcurrency,
        sandbox: ctx.config.agent.sandbox.enabled,
      },
      knowledge: {
        totalSources: ctx.config.knowledge.sources.length,
        enabledSources: ctx.config.knowledge.sources.filter((s) => s.enabled).length,
      },
      providers: {
        total: ctx.config.llm.providers.length,
        default: ctx.config.llm.defaultProvider,
      },
    });
  });

  return router;
}
