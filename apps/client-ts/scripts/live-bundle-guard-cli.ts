import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertLiveClientBuildEnv,
  LiveBundleGuard,
  productionClientApiOrigin,
} from '@libs/app-config-shared-ts/live-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

const clientRoot = join(fileURLToPath(import.meta.url), '..', '..');
const fs = wallNodeFs();

const USAGE = `usage: live-bundle-guard-cli.ts <verify-env|verify-dist>

  verify-env          Assert VITE_API_URL is the production API origin.
  verify-dist         Scan apps/client-ts/dist for a loopback inlined API URL.
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
  case 'verify-env':
    assertLiveClientBuildEnv();
    process.stdout.write(
      `[live-bundle-guard] VITE_API_URL=${productionClientApiOrigin()}\n`
    );
    break;
  case 'verify-dist':
    await new LiveBundleGuard(dirStore(join(clientRoot, 'dist'))).assert(
      'live web dist'
    );
    process.stdout.write('[live-bundle-guard] live web dist API URL OK\n');
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
