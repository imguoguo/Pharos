import { Router } from 'express';
import { appendLog } from '../config/index.js';

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 5 * 60 * 1000;

export function createRateLimiter() {
  return function rateLimiter(req: any, res: any, next: any) {
    if (!req.path.startsWith('/api/')) {
      return next();
    }
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
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
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    next();
  };
}

export function createBruteForceProtection() {
  return function bruteForce(req: any, res: any, next: any) {
    if (req.path !== '/api/auth/login' || req.method !== 'POST') {
      return next();
    }

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = loginAttempts.get(ip);

    if (attempt && attempt.blockedUntil > now) {
      const remaining = Math.ceil((attempt.blockedUntil - now) / 1000);
      appendLog('warn', `Blocked login attempt from ${ip}, ${remaining}s remaining`);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${remaining} seconds.`,
        blockedFor: remaining,
      });
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (res.statusCode === 401) {
        const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
        entry.count++;
        if (entry.count >= MAX_LOGIN_ATTEMPTS) {
          entry.blockedUntil = now + BLOCK_DURATION;
          entry.count = 0;
          appendLog('warn', `IP ${ip} blocked for ${BLOCK_DURATION / 1000}s after ${MAX_LOGIN_ATTEMPTS} failed login attempts`);
        }
        loginAttempts.set(ip, entry);
      } else if (body?.token) {
        loginAttempts.delete(ip);
      }
      return originalJson(body);
    };

    next();
  };
}

export function createSecurityHeaders() {
  return function securityHeaders(_req: any, res: any, next: any) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
