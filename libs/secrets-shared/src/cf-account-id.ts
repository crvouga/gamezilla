import { cliHttp } from './cli-io';
import { cfHeaders, HEX32_RE } from './cloudflare';
import { Secret } from './secret';
import type { SecretInput } from './secret';

async function validateCfAccountId(input: SecretInput): Promise<void> {
  const accountId = input.secretValue.trim();
  if (!HEX32_RE.test(accountId)) {
    throw new Error('Must be a 32-character hex string');
  }
  const token =
    input.secrets.get('CLOUDFLARE_API_TOKEN')?.trim() ||
    process.env['CLOUDFLARE_API_TOKEN']?.trim();
  if (token === undefined || token.length === 0) return;
  try {
    const res = await cliHttp.fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}`,
      { headers: cfHeaders(token) }
    );
    if (res.ok) return;
    if (res.status === 404) throw new Error('Account not found — check the ID');
    if (res.status === 403) {
      throw new Error('Token does not have access to this account');
    }
    throw new Error(`Cloudflare API returned HTTP ${String(res.status)}`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Account')) throw e;
    if (e instanceof Error && e.message.startsWith('Token')) throw e;
    if (e instanceof Error && e.message.startsWith('Cloudflare')) throw e;
    // Network blip — don't fail secret validation on transient errors.
  }
}

export const CLOUDFLARE_ACCOUNT_ID = new Secret({
  name: 'CLOUDFLARE_ACCOUNT_ID',
  hint: 'https://dash.cloudflare.com/ → pick any zone → Overview sidebar → Account ID',
  validate: validateCfAccountId,
});
