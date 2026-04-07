export const HEX32_RE = /^[0-9a-f]{32}$/;

export function cfHeaders(token?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token ?? process.env['CLOUDFLARE_API_TOKEN'] ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export function cfAccountId(): string {
  return (
    process.env['TF_VAR_cloudflare_account_id'] ??
    process.env['CLOUDFLARE_ACCOUNT_ID'] ??
    ''
  );
}

/**
 * Probe whether the token has a specific Cloudflare permission by making a
 * real API call.  Returns `true` if the token has access (any non-403 status),
 * `false` if 403/unauthorized.
 */
export async function probeCfPermission(
  headers: Record<string, string>,
  method: string,
  url: string,
  jsonBody?: unknown,
): Promise<boolean> {
  try {
    const opts: RequestInit = { method, headers };
    if (jsonBody !== undefined) opts.body = JSON.stringify(jsonBody);
    const res = await fetch(url, opts);
    await res.arrayBuffer();
    return res.status !== 403;
  } catch {
    return true;
  }
}
