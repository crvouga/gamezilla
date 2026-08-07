import { authorizeB2, B2_PROVISION_CAPABILITIES } from '../lib/b2-api';
import { requireNonEmpty, Secret, type SecretInput } from './secret';

async function validateB2MasterKeyId(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'B2_MASTER_KEY_ID');
  const masterKey =
    input.secrets.get('B2_MASTER_KEY')?.trim() ||
    (process.env['B2_MASTER_KEY'] ?? '').trim();
  if (masterKey.length === 0) return;
  await assertB2MasterCapabilities(input.secretValue.trim(), masterKey);
}

async function validateB2MasterKey(input: SecretInput): Promise<void> {
  requireNonEmpty(input.secretValue, 'B2_MASTER_KEY');
  const keyId =
    input.secrets.get('B2_MASTER_KEY_ID')?.trim() ||
    (process.env['B2_MASTER_KEY_ID'] ?? '').trim();
  if (keyId.length === 0) return;
  await assertB2MasterCapabilities(keyId, input.secretValue.trim());
}

async function assertB2MasterCapabilities(
  keyId: string,
  masterKey: string
): Promise<void> {
  const auth = await authorizeB2(keyId, masterKey);
  if (auth.capabilities.includes('all')) return;
  const missing = B2_PROVISION_CAPABILITIES.filter(
    (cap) => !auth.capabilities.includes(cap)
  );
  if (missing.length === 0) return;
  throw new Error(
    [
      'B2 master key is missing capabilities required for provision:',
      ...missing.map((cap) => `  - ${cap}`),
      '',
      `Capabilities returned: ${
        auth.capabilities.length > 0 ? auth.capabilities.join(', ') : '(none)'
      }`,
      '',
      'Create a master application key (or a key with writeBuckets/writeKeys)',
      'at https://secure.backblaze.com/app_keys.htm',
    ].join('\n')
  );
}

const B2_MASTER_HINT = [
  'https://secure.backblaze.com/app_keys.htm → Add a New Application Key',
  'Use a master key (or a key with writeBuckets, listBuckets, readBuckets,',
  'writeKeys, listKeys, deleteKeys). Infra uses this only to create buckets',
  'and mint per-env B2_APP_* credentials — it is never pushed to the Worker.',
].join('\n');

export const B2_MASTER_KEY_ID = new Secret({
  name: 'B2_MASTER_KEY_ID',
  hint: B2_MASTER_HINT,
  mirrorToDev: true,
  validate: validateB2MasterKeyId,
});

export const B2_MASTER_KEY = new Secret({
  name: 'B2_MASTER_KEY',
  hint: B2_MASTER_HINT,
  mirrorToDev: true,
  validate: validateB2MasterKey,
});
