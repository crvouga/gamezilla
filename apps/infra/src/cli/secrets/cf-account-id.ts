import { HEX32_RE, cfHeaders } from './cloudflare';
import type { SecretEntry } from './types';

export class CfAccountId implements SecretEntry {
  readonly secretKey = 'CLOUDFLARE_ACCOUNT_ID';
  readonly env = 'CLOUDFLARE_ACCOUNT_ID';
  readonly hint =
    'https://dash.cloudflare.com/ → pick any zone → Overview sidebar → Account ID';

  async validate(accountId: string): Promise<string | null> {
    if (!HEX32_RE.test(accountId)) return 'Must be a 32-character hex string';
    const token = process.env['CLOUDFLARE_API_TOKEN'];
    if (!token) return null;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
        { headers: cfHeaders(token) }
      );
      if (res.ok) return null;
      if (res.status === 404) return 'Account not found — check the ID';
      if (res.status === 403)
        return 'Token does not have access to this account';
      return `Cloudflare API returned HTTP ${res.status}`;
    } catch {
      return null;
    }
  }
}
