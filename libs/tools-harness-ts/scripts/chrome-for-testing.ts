// @io-wall-ok — CI renderer setup: asks mise where the pinned Chrome is installed.
/**
 * The pinned Chrome for Testing (`mise.toml` `http:chrome-for-testing`), the
 * renderer browser tests and visual checks use in CI. mise downloads and
 * unpacks it the same way on Linux, macOS and Windows, so CI needs no
 * browser installer of its own. Prints the browser's executable.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const CHROME_FOR_TESTING_TOOL = 'http:chrome-for-testing';

/** The executable inside an unpacked Chrome for Testing archive. */
export function chromeForTestingBinary(
  installDir: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') return join(installDir, 'chrome.exe');
  if (platform === 'darwin')
    return join(
      installDir,
      'Google Chrome for Testing.app',
      'Contents',
      'MacOS',
      'Google Chrome for Testing'
    );
  return join(installDir, 'chrome');
}

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
