import { createAttrNamespace } from '@pkgs/attribute';

export const clientConfigNs = createAttrNamespace('client-config');

/** PatchDB entity type for public client runtime configuration (singleton). */
export const CLIENT_CONFIG_ENTITY_TYPE = clientConfigNs.prefix;

/** Stable singleton entity ID for client config — shared by server and all clients. */
export const CLIENT_CONFIG_ENTITY_ID = 'client-config__singleton';

function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export const ClientConfigAttr = {
  googleWebClientId: clientConfigNs.textOrNull(
    'google-web-client-id',
    readTrimmedNullableString
  ),
} as const;
