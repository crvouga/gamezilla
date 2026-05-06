import {
  CLIENT_CONFIG_ENTITY_ID,
  CLIENT_CONFIG_ENTITY_TYPE,
  ClientConfigAttr,
} from '@gamezilla/domain/client-config/client-config-entities';
import type { PatchDb } from '@gamezilla/patch-db/interface';

export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
  clerkPublishableKey: string | null;
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
    return { googleWebClientId: null, clerkPublishableKey: null };
  }
  const googleRaw = entity.attributes[ClientConfigAttr.googleWebClientId];
  const googleId =
    typeof googleRaw === 'string' && googleRaw.length > 0 ? googleRaw : null;
  const clerkRaw = entity.attributes[ClientConfigAttr.clerkPublishableKey];
  const clerkPk =
    typeof clerkRaw === 'string' && clerkRaw.length > 0 ? clerkRaw : null;
  return { googleWebClientId: googleId, clerkPublishableKey: clerkPk };
}
