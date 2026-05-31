import { Router } from 'express';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { ServerContext } from '../index.js';

const TOKENS_PATH = resolve(process.cwd(), 'data', 'tokens.json');

function loadTokens(): Map<string, number> {
  if (!existsSync(TOKENS_PATH)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
    const now = Date.now();
    const entries = Object.entries(raw).filter(([, exp]) => (exp as number) > now);
    return new Map(entries as [string, number][]);
  } catch {
    return new Map();
  }
}

function saveTokens(tokens: Map<string, number>): void {
  const obj: Record<string, number> = {};
  const now = Date.now();
  for (const [token, expiry] of tokens) {
    if (expiry > now) obj[token] = expiry;
  }
  writeFileSync(TOKENS_PATH, JSON.stringify(obj), 'utf-8');
}

const tokens = loadTokens();

export function createAuthRouter(ctx: ServerContext): Router {
  const router = Router();

  router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password !== ctx.config.auth.password) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = randomUUID();
    tokens.set(token, Date.now() + ctx.config.auth.tokenExpiry);
    saveTokens(tokens);
    res.json({ token });
  });

  router.post('/verify', (req, res) => {
    const { token } = req.body;
    const expiry = tokens.get(token);
    if (!expiry || Date.now() > expiry) {
      tokens.delete(token);
      saveTokens(tokens);
      return res.status(401).json({ valid: false });
    }
    res.json({ valid: true });
  });

  router.post('/logout', (req, res) => {
    const { token } = req.body;
    tokens.delete(token);
    saveTokens(tokens);
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
      saveTokens(tokens);
      return res.status(401).json({ error: 'Token expired' });
    }
    next();
  }

  return { middleware };
}
