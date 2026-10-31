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
