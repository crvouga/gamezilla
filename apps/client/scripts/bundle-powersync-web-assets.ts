/**
 * Copies `@powersync/web` workers and wasm into `public/generated/powersync/`
 * for Expo web (`WASQLiteOpenFactory` worker paths).
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
// CLI joins `cwd + output + '@powersync'` — keep output relative to clientRoot.
const outputDir = 'public/generated/powersync';

execFileSync('bunx', ['powersync-web', 'copy-assets', '-o', outputDir], {
  cwd: clientRoot,
  stdio: 'inherit',
});

process.stdout.write(
  `[bundle-powersync-web-assets] copied PowerSync web assets to ${join(clientRoot, outputDir, '@powersync')}\n`
);
