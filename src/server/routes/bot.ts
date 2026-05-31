import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { appendLog } from '../../config/index.js';

export function createBotRouter(ctx: ServerContext): Router {
  const router = Router();

  router.post('/restart', async (_req, res) => {
    try {
      await ctx.bot.stop();
    } catch {
      // ignore stop errors
    }
    try {
      await ctx.bot.start();
      appendLog('info', 'Bot restarted via API');
      res.json({ success: true });
    } catch (err: unknown) {
      const error = err as Error;
      appendLog('error', `Bot restart failed: ${error.message}`);
      res.json({ success: false, error: error.message });
    }
  });

  return router;
}
