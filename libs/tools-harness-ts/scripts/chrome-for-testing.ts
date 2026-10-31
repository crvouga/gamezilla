// @io-wall-ok — CI renderer setup: asks mise where the pinned Chrome is installed.
/**
 * The pinned Chrome for Testing (`mise.toml` `http:chrome-for-testing`), the
 * renderer browser tests and visual checks use in CI. mise downloads and
 * unpacks it the same way on Linux, macOS and Windows, so CI needs no
 * browser installer of its own. Prints the browser's executable.
 */
import { spawnSync } from 'node:child_process';
import {
  CHROME_FOR_TESTING_TOOL,
  chromeForTestingBinary,
} from '@pkgs/ui-testing-bun-webview-server-ts/chrome-for-testing';

function main(): void {
  const where = spawnSync('mise', ['where', CHROME_FOR_TESTING_TOOL], {
    encoding: 'utf8',
  });
  const installDir = where.stdout?.trim() ?? '';
  if (where.status !== 0 || installDir.length === 0)
    throw new Error(
      `${CHROME_FOR_TESTING_TOOL} is not installed: run \`mise install ${CHROME_FOR_TESTING_TOOL}\`.\n${where.stderr ?? ''}`
    );
  process.stdout.write(`${chromeForTestingBinary(installDir)}\n`);
}

if (import.meta.main) main();
