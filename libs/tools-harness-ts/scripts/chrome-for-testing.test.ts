import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHROME_FOR_TESTING_TOOL,
  chromeForTestingBinary,
} from '@pkgs/ui-testing-bun-webview-server-ts/chrome-for-testing';

const ROOT = join(import.meta.dirname, '../../..');

test('the pinned Chrome is found inside its archive on every runner OS', () => {
  expect(chromeForTestingBinary('/m/cft', 'linux')).toBe(
    join('/m/cft', 'chrome')
  );
  expect(chromeForTestingBinary('/m/cft', 'darwin')).toBe(
    join(
      '/m/cft',
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    )
  );
  expect(chromeForTestingBinary('/m/cft', 'win32')).toBe(
    join('/m/cft', 'chrome.exe')
  );
});

test('mise pins one Chrome for Testing build for every runner platform', () => {
  const { tools } = Bun.TOML.parse(
    readFileSync(join(ROOT, 'mise.toml'), 'utf8')
  ) as {
    tools: Record<
      string,
      { version: string; platforms: Record<string, { url: string }> }
    >;
  };
  const chrome = tools[CHROME_FOR_TESTING_TOOL]!;
  const builds = {
    'linux-x64': 'linux64',
    'macos-arm64': 'mac-arm64',
    'macos-x64': 'mac-x64',
    'windows-x64': 'win64',
  };
  expect(Object.keys(chrome.platforms).sort()).toEqual(
    Object.keys(builds).sort()
  );
  for (const [platform, build] of Object.entries(builds))
    expect(chrome.platforms[platform]!.url).toBe(
      `https://storage.googleapis.com/chrome-for-testing-public/{{version}}/${build}/chrome-${build}.zip`
    );
});
