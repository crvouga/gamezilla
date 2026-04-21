export const SERVERS = [
  {
    name: 'local',
    /** Must match `packages/api` `wrangler dev --port` (8787 is used by @gamezilla/turbo-cache). */
    url: new URL('http://localhost:8788'),
  },
  {
    name: 'production',
    url: new URL('https://api.gamezilla.app'),
  },
] as const;

export function getServerFromEnv(): URL {
  const override = process.env['EXPO_PUBLIC_API_URL'];
  if (override) {
    return new URL(override);
  }
  if (isLocalEnv()) {
    return SERVERS[0].url;
  }
  return SERVERS[1].url;
}

/** Same origin string as the active {@link getServerFromEnv} entry (no trailing path). */
export function getApiBaseUrl(): string {
  return getServerFromEnv().origin;
}

/**
 * If `apiUrl` matches a known {@link SERVERS} entry (by origin), returns that
 * entry's `name`; otherwise `undefined`.
 */
export function getKnownServerNameForApiUrl(
  apiUrl: string
): string | undefined {
  let origin: string;
  try {
    origin = new URL(apiUrl).origin;
  } catch {
    return undefined;
  }
  for (const s of SERVERS) {
    if (s.url.origin === origin) {
      return s.name;
    }
  }
  return undefined;
}

/**
 * Whether to use the bundled local dev API URL (see `SERVERS` local entry).
 * Uses several signals so one mis-set flag does not silently point a dev build at prod.
 */
function isLocalEnv(): boolean {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return true;
  }
  return process.env.NODE_ENV === 'development';
}
