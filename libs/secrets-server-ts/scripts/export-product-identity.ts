// @io-wall-ok — export validated public configuration after CI secret injection.
import { appendFileSync } from 'node:fs';
import { configuredIdentity } from '@libs/product-brand-shared-ts/identity-input';

const mode = process.env['PRODUCT_IDENTITY_MODE'] ?? 'fixture';
if (mode !== 'fixture' && mode !== 'configured')
  throw new Error('PRODUCT_IDENTITY_MODE must be fixture or configured');

const injected = process.env['PRODUCT_IDENTITY_JSON'];
const repository = process.env['REPOSITORY_IDENTITY_JSON'];
if (injected?.trim() || repository?.trim()) {
  const identity = configuredIdentity(injected, () => repository);
  const destination = process.env['GITHUB_ENV'];
  if (!destination)
    throw new Error('GITHUB_ENV is required to export identity');
  // Compact JSON escapes embedded newlines; it cannot add an environment entry.
  // The mode travels with it: a later step that materializes the identity
  // (generate:identity) otherwise reads a present identity as configured, and
  // a fixture job renders the real brand.
  // regression: fixture-job-materializes-configured-identity
  appendFileSync(
    destination,
    `PRODUCT_IDENTITY_JSON=${JSON.stringify(identity)}\nPRODUCT_IDENTITY_MODE=${mode}\n`
  );
  console.log('Public build identity injected; values omitted.');
}
