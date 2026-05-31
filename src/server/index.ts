import express from 'express';
import cors from 'cors';
import { resolve } from 'path';
import type { AppConfig } from '../types/config.js';
import { createApiRouter } from './routes/index.js';
import { createAuthMiddleware } from './routes/auth.js';
import type { AgentExecutor } from '../agent/executor.js';
import type { DiscordBot } from '../bot/index.js';

export interface ServerContext {
  config: AppConfig;
  agent: AgentExecutor;
  bot: DiscordBot;
}

export function createServer(ctx: ServerContext): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const { middleware } = createAuthMiddleware(ctx);
  app.use(middleware);

  app.use('/api', createApiRouter(ctx));

  const webDist = resolve(process.cwd(), 'dist/web');
  app.use(express.static(webDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(resolve(webDist, 'index.html'));
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
