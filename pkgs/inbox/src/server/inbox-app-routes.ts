import type { Hono } from 'hono';
import type { InboxRequestContext } from './inbox-context';
import {
  archiveInteraction,
  dismissInteraction,
  listInteractions,
  markAllInteractionsRead,
  markInteractionRead,
  performInteractionAction,
} from './service';

export function registerInboxRoutes(
  app: Hono,
  requestContext: () => InboxRequestContext
): void {
  app.get('/interactions', async (c) => {
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

  app.post('/interactions/read-all', async (c) => {
    const { sql, actorId } = requestContext();
    await markAllInteractionsRead(sql, actorId);
    return c.json({ ok: true });
  });

  app.post('/interactions/:id/read', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await markInteractionRead(
      sql,
      actorId,
      c.req.param('id')
    );
    return c.json({ interaction });
  });

  app.post('/interactions/:id/archive', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await archiveInteraction(
      sql,
      actorId,
      c.req.param('id')
    );
    return c.json({ interaction });
  });

  app.post('/interactions/:id/dismiss', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await dismissInteraction(
      sql,
      actorId,
      c.req.param('id')
    );
    return c.json({ interaction });
  });

  app.post('/interactions/:id/actions/:actionId', async (c) => {
    const { sql, actorId } = requestContext();
    const interaction = await performInteractionAction(
      sql,
      actorId,
      c.req.param('id'),
      c.req.param('actionId')
    );
    return c.json({ interaction });
  });
}
