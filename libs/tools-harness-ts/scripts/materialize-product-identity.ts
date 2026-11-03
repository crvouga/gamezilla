// @io-wall-ok — configuration composition root; no network or credential logging.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { materializedIdentity } from './materialize-product-identity-input';

const path = join(
  import.meta.dirname,
  '../../product-identity/product-identity.json'
);
const raw = process.env['PRODUCT_IDENTITY_JSON'];
const development = process.argv.includes('--development');
const fixture =
  development && process.env['PRODUCT_IDENTITY_MODE'] === 'fixture';
const mode =
  fixture || (development && raw === undefined) ? 'fixture' : 'configured';
const identity = materializedIdentity(raw, mode === 'fixture');
writeFileSync(path, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`identity: materialized ${mode} configuration (values omitted)`);
