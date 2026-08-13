// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Ensure `@embedded-postgres/*` postinstall symlinks exist.
 * Bun may skip optional-dep lifecycle scripts unless trusted; hydrate here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, platform } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function platformPackageName(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'darwin' && cpu === 'arm64')
    return '@embedded-postgres/darwin-arm64';
  if (os === 'darwin' && cpu === 'x64') return '@embedded-postgres/darwin-x64';
  if (os === 'linux' && cpu === 'arm64')
    return '@embedded-postgres/linux-arm64';
  if (os === 'linux' && cpu === 'arm') return '@embedded-postgres/linux-arm';
  if (os === 'linux' && cpu === 'x64') return '@embedded-postgres/linux-x64';
  if (os === 'linux' && cpu === 'ia32') return '@embedded-postgres/linux-ia32';
  if (os === 'linux' && cpu === 'ppc64')
    return '@embedded-postgres/linux-ppc64';
  if (os === 'win32' && cpu === 'x64') return '@embedded-postgres/windows-x64';
  throw new Error(
    `[postgres] unsupported platform for embedded-postgres: ${os}/${cpu}`
  );
}

function resolvePlatformPackageRoot(): string {
  const embeddedPkg = require.resolve('embedded-postgres/package.json');
  const fromEmbedded = createRequire(embeddedPkg);
  const name = platformPackageName();
  const platformPkgJson = fromEmbedded.resolve(`${name}/package.json`);
  return dirname(platformPkgJson);
}

const root = resolvePlatformPackageRoot();
const hydrate = join(root, 'scripts', 'hydrate-symlinks.js');
if (!existsSync(hydrate)) {
  throw new Error(`[postgres] missing hydrate script at ${hydrate}`);
}

process.stdout.write(
  `[postgres] install:deps — hydrating symlinks in ${root}\n`
);
const result = spawnSync(process.execPath, [hydrate], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
