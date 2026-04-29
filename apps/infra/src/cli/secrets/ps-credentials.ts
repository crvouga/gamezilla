import type { SecretEntry } from './types';

export class PsServiceTokenId implements SecretEntry {
  readonly secretKey = 'PLANETSCALE_SERVICE_TOKEN_ID';
  readonly env = 'PLANETSCALE_SERVICE_TOKEN_ID';
  readonly hint =
    'https://app.planetscale.com/ → Org Settings → Service tokens → Token ID';

  async validate(value: string): Promise<string | null> {
    return validateCredentials(value, 'id');
  }
}

export class PsServiceToken implements SecretEntry {
  readonly secretKey = 'PLANETSCALE_SERVICE_TOKEN';
  readonly env = 'PLANETSCALE_SERVICE_TOKEN';
  readonly hint =
    'https://app.planetscale.com/ → Org Settings → Service tokens → Token value';

  async validate(value: string): Promise<string | null> {
    return validateCredentials(value, 'token');
  }
}

async function validateCredentials(
  value: string,
  kind: 'id' | 'token'
): Promise<string | null> {
  if (value.length === 0) return 'Must be a non-empty string';
  const id =
    kind === 'id' ? value : process.env['PLANETSCALE_SERVICE_TOKEN_ID'];
  const token =
    kind === 'token' ? value : process.env['PLANETSCALE_SERVICE_TOKEN'];
  if (!id || !token) return null;
  try {
    const res = await fetch('https://api.planetscale.com/v1/organizations', {
      headers: { Authorization: `${id}:${token}`, Accept: 'application/json' },
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403)
      return 'Service token credentials are invalid';
    return `PlanetScale API returned HTTP ${res.status}`;
  } catch {
    return null;
  }
}
