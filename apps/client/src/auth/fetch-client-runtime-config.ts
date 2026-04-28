import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import type { PatchesDb } from '@gamezilla/patch-db/interface';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

export async function readClientRuntimeConfig(
  db: PatchesDb
): Promise<ClientRuntimeConfig> {
  const [result] = await db.read([
    {
      entityType: CLIENT_CONFIG_ENTITY_TYPE,
      entityId: CLIENT_CONFIG_ENTITY_ID,
    },
  ]);
  const entity = result?.entities[0];
  if (!entity) return { googleWebClientId: null };
  const raw = entity.attributes[ClientConfigAttr.googleWebClientId];
  const id = typeof raw === 'string' && raw.length > 0 ? raw : null;
  return { googleWebClientId: id };
}
