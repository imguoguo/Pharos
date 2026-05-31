import { Router } from 'express';
import { randomUUID } from 'crypto';
import type { ServerContext } from '../index.js';

const tokens = new Map<string, number>();

export function createAuthRouter(ctx: ServerContext): Router {
  const router = Router();

  router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password !== ctx.config.auth.password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = randomUUID();
    tokens.set(token, Date.now() + ctx.config.auth.tokenExpiry);
    res.json({ token });
  });

  router.post('/verify', (req, res) => {
    const { token } = req.body;
    const expiry = tokens.get(token);
    if (!expiry || Date.now() > expiry) {
      tokens.delete(token);
      return res.status(401).json({ valid: false });
    }
    res.json({ valid: true });
  });

  router.post('/logout', (req, res) => {
    const { token } = req.body;
    tokens.delete(token);
    res.json({ success: true });
  });

  return router;
}

export function createAuthMiddleware(ctx: ServerContext) {
  function middleware(req: any, res: any, next: any) {
    if (req.path.startsWith('/api/auth/')) {
      return next();
    }
    if (!req.path.startsWith('/api/')) {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.slice(7);
    const expiry = tokens.get(token);
    if (!expiry || Date.now() > expiry) {
      tokens.delete(token);
      return res.status(401).json({ error: 'Token expired' });
    }
    next();
  }

  return { middleware };
}
