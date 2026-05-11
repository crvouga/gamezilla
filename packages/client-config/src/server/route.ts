import type { ApiHonoEnv } from '@gamezilla/api-types/api-hono-types';
import { ApiSecretName } from '@gamezilla/api-types/secret-names';
import { isEqual } from '@gamezilla/lib/equal/is-equal';
import type { Logger } from '@gamezilla/lib/logger';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { Context } from 'hono';
import { Hono } from 'hono';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '../shared/client-config-entities';

export type ClientConfigRefreshOutcome = 'unchanged' | 'updated';

export type ClientConfigRefreshResponseBody = {
  ok: true;
  outcome: ClientConfigRefreshOutcome;
  /** Attributes snapshot before this request (null if no entity existed). */
  before: Record<string, unknown> | null;
  /** Attributes snapshot after this request (same as `before` when `outcome` is `unchanged`). */
  after: Record<string, unknown> | null;
};

function snapshotAttributes(
  attrs: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (attrs === undefined) return null;
  return { ...attrs };
}

async function loadClientConfigAttributesFromDoppler(
  secretStore: SecretStore
): Promise<Record<string, unknown>> {
  const googleWebClientId = await secretStore.getOptional(
    ApiSecretName.googleWebClientId
  );
  return ClientConfigAttr.googleWebClientId(googleWebClientId);
}

/**
 * `POST /client-config/refresh` — writes the singleton clientConfig entity into patch-db
 * so clients receive it via the normal sync cycle. Invoked by the infra deploy pipeline
 * after smoke tests pass (not by clients).
 *
 * Resolves `WEB_CLIENT_GOOGLE_CLIENT_ID` from Doppler via {@link SecretStore}.
 *
 * Response JSON includes `outcome`, `before`, and `after` attribute snapshots for debugging
 * and deploy logs.
 *
 * @see https://hono.dev/docs/guides/best-practices — mount sub-apps with `app.route()`.
 */
async function handleClientConfigRefresh(
  c: Context<ApiHonoEnv>,
  deps: {
    logger: Logger;
    secretStore: SecretStore;
  }
): Promise<Response> {
  const db = c.get('patchDb');
  const { logger, secretStore } = deps;
  logger.info('POST /client-config/refresh: requested');
  const configNew = await loadClientConfigAttributesFromDoppler(secretStore);

  const configPrevResult = await db.read([
    {
      entityId: CLIENT_CONFIG_ENTITY_ID,
      entityType: CLIENT_CONFIG_ENTITY_TYPE,
    },
  ]);
  const configPrev = configPrevResult[0]?.entities[0]?.attributes;
  const before = snapshotAttributes(configPrev);
  logger.debug('Client config comparison', { configPrev, configNew });

  if (isEqual(configPrev, configNew)) {
    logger.info('No changes to client config; skipping write.', {
      outcome: 'unchanged',
      before,
      after: before,
    });
    const body: ClientConfigRefreshResponseBody = {
      ok: true,
      outcome: 'unchanged',
      before,
      after: before,
    };
    return c.json(body, 200);
  }

  logger.info('Updating client config in PatchDB', { config: configNew });
  await db.write([
    {
      entityId: CLIENT_CONFIG_ENTITY_ID,
      entityType: CLIENT_CONFIG_ENTITY_TYPE,
      attributes: configNew,
    },
  ]);

  const configAfterResult = await db.read([
    {
      entityId: CLIENT_CONFIG_ENTITY_ID,
      entityType: CLIENT_CONFIG_ENTITY_TYPE,
    },
  ]);
  const afterAttrs = configAfterResult[0]?.entities[0]?.attributes;
  const after = snapshotAttributes(afterAttrs);

  logger.info('Client config updated successfully.', {
    outcome: 'updated',
    before,
    after,
  });
  const body: ClientConfigRefreshResponseBody = {
    ok: true,
    outcome: 'updated',
    before,
    after,
  };
  return c.json(body, 200);
}

export function createClientConfigApp(
  logger: Logger,
  secretStore: SecretStore
) {
  return new Hono<ApiHonoEnv>().post('/client-config/refresh', async (c) =>
    handleClientConfigRefresh(c, { logger, secretStore })
  );
}
