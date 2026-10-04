import type { Hono } from 'hono';
import type { NotificationsRequestContext } from './notifications-context';
import {
  archiveInteraction,
  dismissInteraction,
  listInteractions,
  markAllInteractionsRead,
  markInteractionRead,
  performNotificationAction,
} from './service';

export function registerInboxRoutes(
  app: Hono,
  requestContext: () => NotificationsRequestContext,
  now: () => number
): void {
  app.get('/notifications', async (c) => {
    const { sql, actorId } = requestContext();
    const filterRaw = c.req.query('filter');
    const filter =
      filterRaw === 'archived' || filterRaw === 'action_required'
        ? filterRaw
        : 'all';
    const cursor = c.req.query('cursor');
    const limitRaw = c.req.query('limit');
    const parsedLimit =
      limitRaw !== undefined && limitRaw.length > 0
        ? Number.parseInt(limitRaw, 10)
        : undefined;
    const page = await listInteractions(sql, {
      userId: actorId,
      filter,
      ...(cursor !== undefined && cursor.length > 0 ? { cursor } : {}),
      ...(parsedLimit !== undefined && Number.isFinite(parsedLimit)
        ? { limit: parsedLimit }
        : {}),
    });
    return c.json(page);
  });

  app.post('/notifications/read-all', async (c) => {
    const { sql, actorId } = requestContext();
    await markAllInteractionsRead(sql, actorId, now);
    return c.json({ ok: true });
  });

  app.post('/notifications/:id/read', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await markInteractionRead(
      sql,
      actorId,
      c.req.param('id'),
      now
    );
    return c.json({ interaction });
  });

  app.post('/notifications/:id/archive', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await archiveInteraction(
      sql,
      actorId,
      c.req.param('id'),
      now
    );
    return c.json({ interaction });
  });

  app.post('/notifications/:id/dismiss', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await dismissInteraction(
      sql,
      actorId,
      c.req.param('id'),
      now
    );
    return c.json({ interaction });
  });

  app.post('/notifications/:id/actions/:actionId', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await performNotificationAction(
      sql,
      actorId,
      c.req.param('id'),
      c.req.param('actionId')
    );
    return c.json({ interaction });
  });
}
