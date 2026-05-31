import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { appendLog } from '../config/index.js';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

export function createRateLimiter() {
  return function rateLimiter(req: any, res: any, next: any) {
    if (!req.path.startsWith('/api/') || req.path.startsWith('/api/auth/')) {
      return next();
    }
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = requestCounts.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW };
      requestCounts.set(ip, entry);
    }

    entry.count++;
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT - entry.count));

    if (entry.count > RATE_LIMIT) {
      appendLog('warn', `Rate limit exceeded for ${ip}`);
      return res.status(429).json({ error: 'Too many requests' });
    }
    next();
  };
}

export function createHealthRouter(): Router {
  const router = Router();
  const startTime = Date.now();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
