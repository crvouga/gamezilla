import { createAttrNamespace } from '@gamezilla/lib/attribute';

/** PatchDB entity type for public client runtime configuration (singleton). */
export const CLIENT_CONFIG_ENTITY_TYPE = 'clientConfig';

/** Stable singleton entity ID for client config — shared by server and all clients. */
export const CLIENT_CONFIG_ENTITY_ID = 'clientConfig__singleton';

function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const clientConfigNs = createAttrNamespace('clientConfig');

export const ClientConfigAttr = {
  googleWebClientId: clientConfigNs(
    'googleWebClientId',
    readTrimmedNullableString
  ),
} as const;
