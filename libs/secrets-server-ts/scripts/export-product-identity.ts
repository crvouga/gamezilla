// @io-wall-ok — export validated public configuration after CI secret injection.
import { appendFileSync } from 'node:fs';
import { configuredIdentity } from '@libs/product-identity-shared-ts/identity-input';

const injected = process.env['PRODUCT_IDENTITY_JSON'];
const repository = process.env['REPOSITORY_IDENTITY_JSON'];
if (injected?.trim() || repository?.trim()) {
  const identity = configuredIdentity(injected, () => repository);
  const destination = process.env['GITHUB_ENV'];
  if (!destination)
    throw new Error('GITHUB_ENV is required to export identity');
  // Compact JSON escapes embedded newlines; it cannot add an environment entry.
  appendFileSync(
    destination,
    `PRODUCT_IDENTITY_JSON=${JSON.stringify(identity)}\n`
  );
  console.log('Public build identity injected; values omitted.');
}
