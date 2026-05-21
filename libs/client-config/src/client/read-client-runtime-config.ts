import type { PatchDb } from '@pkgs/patch-db/interface';
import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '../shared/client-config-entities';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

export async function readClientRuntimeConfig(
  db: PatchDb
): Promise<ClientRuntimeConfig> {
  const [result] = await db.read([
    {
      entityType: CLIENT_CONFIG_ENTITY_TYPE,
      entityId: CLIENT_CONFIG_ENTITY_ID,
    },
  ]);
  const entity = result?.entities[0];
  if (!entity) {
    return { googleWebClientId: null };
  }
  const googleRaw = entity.attributes[ClientConfigAttr.googleWebClientId.key];
  const googleId =
    typeof googleRaw === 'string' && googleRaw.length > 0 ? googleRaw : null;
  return { googleWebClientId: googleId };
}
