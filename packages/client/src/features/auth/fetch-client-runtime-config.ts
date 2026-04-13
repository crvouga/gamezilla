export type ClientRuntimeConfig = {
  googleWebClientId: string | null;
};

/**
 * Public client configuration from the API (same Google Web client ID the server
 * uses for id_token audience checks). No build-time secrets.
 */
export async function fetchClientRuntimeConfig(
  apiUrl: string
): Promise<ClientRuntimeConfig> {
  const base = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/client-config`);
  if (!res.ok) {
    throw new Error(`client-config request failed (${String(res.status)})`);
  }
  const json: unknown = await res.json();
  if (json === null || typeof json !== 'object') {
    throw new Error('client-config response must be a JSON object');
  }
  const rec = json as Record<string, unknown>;
  const id = rec['googleWebClientId'];
  if (id === null || id === undefined) {
    return { googleWebClientId: null };
  }
  if (typeof id !== 'string') {
    throw new Error('googleWebClientId must be string or null');
  }
  return { googleWebClientId: id.length > 0 ? id : null };
}
