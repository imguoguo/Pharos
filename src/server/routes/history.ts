import { Router } from 'express';
import type { ServerContext } from '../index.js';
import { loadChannelHistory, listChannelsWithHistory } from '../../config/index.js';

export function createHistoryRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get('/channels', (_req, res) => {
    const channels = listChannelsWithHistory();
    res.json(channels);
  });

  router.get('/channels/:channelId', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = loadChannelHistory(req.params.channelId);
    const total = entries.length;
    const sorted = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const offset = (page - 1) * limit;
    res.json({
      channelId: req.params.channelId,
      total,
      page,
      limit,
      entries: sorted.slice(offset, offset + limit),
    });
  });

  return router;
}
