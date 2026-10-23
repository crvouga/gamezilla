import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertLiveClientBuildEnv,
  LiveBundleGuard,
  productionClientApiOrigin,
} from '@libs/app-config-shared-ts/live-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

const productRoot = join(fileURLToPath(import.meta.url), '..', '..');
const fs = wallNodeFs();

const USAGE = `usage: live-bundle-guard-cli.ts <verify-env|verify-dist>

  verify-env [--expected-origin=<url>]
                     Assert VITE_API_URL is the deployed environment's API
                     origin (default: production).
  verify-dist [--expected-origin=<url>]
                     Assert apps/product-ts/dist inlines that API origin
                     (default: production).
`;

function dirStore(dir: string) {
  return createNodeFsObjectStore({ rootDir: dir, fs, layout: 'tree' });
}

function expectedOrigin(): string {
  const flag = process.argv.find((a) => a.startsWith('--expected-origin='));
  return flag === undefined
    ? productionClientApiOrigin()
    : flag.slice('--expected-origin='.length);
}

const subcommand = process.argv[2];
if (subcommand === undefined) {
  process.stderr.write(USAGE);
  process.exit(1);
}

switch (subcommand) {
  case 'verify-env': {
    const expected = expectedOrigin();
    assertLiveClientBuildEnv(process.env, expected);
    process.stdout.write(`[live-bundle-guard] VITE_API_URL=${expected}\n`);
    break;
  }
  case 'verify-dist':
    await new LiveBundleGuard(
      dirStore(join(productRoot, 'dist')),
      expectedOrigin()
    ).assert('live web dist');
    process.stdout.write('[live-bundle-guard] live web dist API URL OK\n');
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
