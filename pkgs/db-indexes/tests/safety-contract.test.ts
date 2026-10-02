// @io-wall-ok — test entry reads the package's technical contracts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runFeature } from '@pkgs/gherkin/bun-test';
import './contract-steps';

const contracts = join(import.meta.dir, 'contracts');
for (const name of [
  ...new Bun.Glob('*.feature').scanSync({ cwd: contracts }),
].sort()) {
  runFeature(readFileSync(join(contracts, name), 'utf8'), {
    packageName: '@pkgs/db-indexes',
    featureUri: `tests/contracts/${name}`,
    tags: '',
  });
}
