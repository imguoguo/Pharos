import { Router } from 'express';
import type { ServerContext } from '../index.js';
import type { ConversationEntry } from '../../types/agent.js';

const history: ConversationEntry[] = [];
const MAX_HISTORY = 500;

export function addHistoryEntry(entry: ConversationEntry): void {
  history.unshift(entry);
  if (history.length > MAX_HISTORY) {
    history.pop();
  }
}

export function createHistoryRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    res.json({
      total: history.length,
      page,
      limit,
      entries: history.slice(offset, offset + limit),
    });
  });

  router.get('/:id', (req, res) => {
    const entry = history.find((h) => h.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  });

  router.delete('/', (_req, res) => {
    history.length = 0;
    res.status(204).end();
  });

  return router;
}
