import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertProductionClientBuildEnv,
  ProductionBundleGuard,
  productionClientApiOrigin,
} from '@libs/client-config/public/production-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

const productRoot = join(fileURLToPath(import.meta.url), '..', '..');
const fs = wallNodeFs();

const USAGE = `usage: production-bundle-guard-cli.ts <check-env|check-dist>

  check-env [--expected-origin=<url>]
                     Assert VITE_API_URL is the deployed environment's API
                     origin (default: production).
  check-dist         Scan apps/product/dist for a loopback inlined API URL.
`;

function dirStore(dir: string) {
  return createNodeFsObjectStore({ rootDir: dir, fs, layout: 'tree' });
}

const subcommand = process.argv[2];
if (subcommand === undefined) {
  process.stderr.write(USAGE);
  process.exit(1);
}

switch (subcommand) {
  case 'check-env': {
    const flag = process.argv.find((a) => a.startsWith('--expected-origin='));
    const expected =
      flag === undefined
        ? productionClientApiOrigin()
        : flag.slice('--expected-origin='.length);
    assertProductionClientBuildEnv(process.env, expected);
    process.stdout.write(
      `[production-bundle-guard] VITE_API_URL=${expected}\n`
    );
    break;
  }
  case 'check-dist':
    await new ProductionBundleGuard(dirStore(join(productRoot, 'dist'))).assert(
      'production web dist'
    );
    process.stdout.write(
      '[production-bundle-guard] production web dist API URL OK\n'
    );
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
