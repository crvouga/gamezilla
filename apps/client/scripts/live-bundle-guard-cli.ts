import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLiveClientBuildEnv, LiveBundleGuard, productionClientApiOrigin } from '@libs/app-config-shared/live-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

const clientRoot = join(fileURLToPath(import.meta.url), '..', '..');
const fs = wallNodeFs();

const USAGE = `usage: live-bundle-guard-cli.ts <check-env|check-dist>

  check-env          Assert VITE_API_URL is the production API origin.
  check-dist         Scan apps/client/dist for a loopback inlined API URL.
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
  case 'check-env':
    assertLiveClientBuildEnv();
    process.stdout.write(
      `[live-bundle-guard] VITE_API_URL=${productionClientApiOrigin()}\n`
    );
    break;
  case 'check-dist':
    await new LiveBundleGuard(dirStore(join(clientRoot, 'dist'))).assert(
      'live web dist'
    );
    process.stdout.write('[live-bundle-guard] live web dist API URL OK\n');
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
