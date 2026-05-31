import express from 'express';
import { resolve } from 'path';
import type { AppConfig } from '../types/config.js';
import { createApiRouter } from './routes/index.js';
import { createAuthMiddleware } from './routes/auth.js';
import { createRateLimiter, createBruteForceProtection, createSecurityHeaders, createHealthRouter } from './middleware.js';
import type { AgentExecutor } from '../agent/executor.js';
import type { DiscordBot } from '../bot/index.js';

export interface ServerContext {
  config: AppConfig;
  agent: AgentExecutor;
  bot: DiscordBot;
}

export function createServer(ctx: ServerContext): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(createSecurityHeaders());
  app.use(express.json({ limit: '1mb' }));
  app.use(createRateLimiter());
  app.use(createBruteForceProtection());

  app.use(createHealthRouter());

  const { middleware } = createAuthMiddleware(ctx);
  app.use(middleware);

  app.use('/api', createApiRouter(ctx));

  const webDist = resolve(process.cwd(), 'dist/public');
  app.use(express.static(webDist, {
    maxAge: '1d',
    etag: true,
  }));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(resolve(webDist, 'index.html'));
  });

  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[Pharos] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export function startServer(ctx: ServerContext): void {
  const app = createServer(ctx);
  const { port, host } = ctx.config.server;

  app.listen(port, host, () => {
    console.log(`[Pharos] Server running at http://${host}:${port}`);
  });
}
