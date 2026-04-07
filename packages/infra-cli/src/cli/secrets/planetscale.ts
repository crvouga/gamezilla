export const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

export function psHeaders(): Record<string, string> {
  const id = process.env['PLANETSCALE_SERVICE_TOKEN_ID'] ?? '';
  const token = process.env['PLANETSCALE_SERVICE_TOKEN'] ?? '';
  return { Authorization: `${id}:${token}`, Accept: 'application/json' };
}
