import type { PatchesDb } from '@gamezilla/patch-db/interface';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/auth';
import { isEqual } from '@gamezilla/lib/equal/is-equal';
import { Logger } from '@gamezilla/lib/logger';
import { Hono } from 'hono';

/**
 * `POST /client-config/refresh` — writes the singleton clientConfig entity into patch-db
 * so clients receive it via the normal sync cycle. Invoked by the infra deploy pipeline
 * after smoke tests pass (not by clients).
 *
 * @see https://hono.dev/docs/guides/best-practices — mount sub-apps with `app.route()`.
 */
export function createClientConfigApp(
  db: PatchesDb,
  logger: Logger,
  googleClientId: string | undefined
) {
  const googleWebClientId =
    googleClientId !== undefined && googleClientId !== ''
      ? googleClientId
      : null;

  return new Hono().post('/client-config/refresh', async (c) => {
    logger.info('POST /client-config/refresh: requested');
    const configPrevResult = await db.read([
      {
        entityId: CLIENT_CONFIG_ENTITY_ID,
        entityType: CLIENT_CONFIG_ENTITY_TYPE,
      },
    ]);
    const configPrev = configPrevResult[0]?.entities[0]?.attributes;
    const configNew = {
      [ClientConfigAttr.googleWebClientId]: googleWebClientId,
    };
    logger.debug('Client config comparison', { configPrev, configNew });
    if (isEqual(configPrev, configNew)) {
      logger.info('No changes to client config; skipping write.');
      return c.json({ ok: true }, 200);
    }
    logger.info('Updating client config in PatchDB', { config: configNew });
    await db.write([
      {
        entityId: CLIENT_CONFIG_ENTITY_ID,
        entityType: CLIENT_CONFIG_ENTITY_TYPE,
        attributes: {
          [ClientConfigAttr.googleWebClientId]: googleWebClientId,
        },
      },
    ]);
    logger.info('Client config updated successfully.');
    return c.json({ ok: true }, 200);
  });
}
