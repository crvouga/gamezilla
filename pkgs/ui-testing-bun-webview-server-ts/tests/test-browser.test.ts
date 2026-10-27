import { expect, test } from 'bun:test';
import {
  type ChromeHost,
  chromeVersion,
  findChrome,
} from '@pkgs/ui-testing-bun-webview-server-ts/test-browser';

function windowsHost(installed: readonly string[]): ChromeHost {
  return {
    env: {
      ProgramFiles: 'C:\\Program Files',
      'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      LOCALAPPDATA: 'C:\\Users\\runner\\AppData\\Local',
    },
    platform: 'win32',
    which: () => null,
    exists: (path) => installed.includes(path),
  };
}

test('Windows finds Chrome in the per-machine and per-user install locations', () => {
  const user =
    'C:\\Users\\runner\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  const x86 =
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
  expect(findChrome(windowsHost([user]))).toBe(user);
  expect(findChrome(windowsHost([user, x86]))).toBe(x86);
  expect(findChrome(windowsHost([]))).toBeNull();
  const explicit = windowsHost([user]);
  expect(
    findChrome({
      ...explicit,
      env: { ...explicit.env, BUN_CHROME_PATH: 'D:\\cft\\chrome.exe' },
    })
  ).toBe('D:\\cft\\chrome.exe');
});

test('POSIX hosts never look in the Windows install locations', () => {
  const host = windowsHost([
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]);
  expect(
    findChrome({
      ...host,
      platform: 'linux',
      which: (name) => (name === 'chromium' ? '/usr/bin/chromium' : null),
    })
  ).toBe('/usr/bin/chromium');
});

test('Windows reads the version from chrome.exe without launching it', () => {
  const calls: { argv: readonly string[]; path: string | undefined }[] = [];
  const version = chromeVersion(
    "C:\\cft\\it's\\chrome.exe",
    'win32',
    (argv, env) => {
      calls.push({ argv, path: env?.['CHROME_VERSION_PATH'] });
      return {
        exitCode: 0,
        stdout: 'Google Chrome for Testing 140.0.7339.80\r\n',
      };
    }
  );
  expect(version).toBe('Google Chrome for Testing 140.0.7339.80');
  expect(calls).toHaveLength(1);
  expect(calls[0]!.argv[0]).toBe('powershell.exe');
  expect(calls[0]!.argv).not.toContain('--version');
  expect(calls[0]!.path).toBe("C:\\cft\\it's\\chrome.exe");
  expect(
    chromeVersion('C:\\missing.exe', 'win32', () => ({
      exitCode: 1,
      stdout: '',
    }))
  ).toBeNull();
  expect(
    chromeVersion('C:\\blank.exe', 'win32', () => ({
      exitCode: 0,
      stdout: ' \r\n',
    }))
  ).toBeNull();
});

test('POSIX hosts ask the browser for its version', () => {
  const version = chromeVersion('/usr/bin/chromium', 'linux', (argv, env) => {
    expect(argv).toEqual(['/usr/bin/chromium', '--version']);
    expect(env).toBeUndefined();
    return { exitCode: 0, stdout: 'Chromium 140.0.7339.80 \n' };
  });
  expect(version).toBe('Chromium 140.0.7339.80');
});
