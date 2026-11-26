import { describe, expect, test } from 'bun:test';
import { appLink, devLogPath, devStatusLine, storybookLink } from './dev-links';

describe('bun dev links', () => {
  test('the app link waits for this boot to publish its web origin', () => {
    const manifest = { webOrigin: 'http://127.0.0.1:5484', startedAtMs: 20 };
    expect(appLink(null, 10)).toBeNull();
    expect(appLink({ ...manifest, startedAtMs: 5 }, 10)).toBeNull();
    expect(appLink({ ...manifest, webOrigin: null }, 10)).toBeNull();
    expect(appLink(manifest, 10)).toBe('http://127.0.0.1:5484/');
  });

  test('the Storybook link waits for a live, ready launcher', () => {
    const record = {
      status: 'ready',
      pid: 7,
      localUrl: 'http://127.0.0.1:6006',
    };
    expect(storybookLink(null, () => true)).toBeNull();
    expect(
      storybookLink({ ...record, status: 'starting' }, () => true)
    ).toBeNull();
    expect(storybookLink(record, () => false)).toBeNull();
    expect(storybookLink(record, (pid) => pid === 7)).toBe(
      'http://127.0.0.1:6006/'
    );
  });

  test('one status row links the log and both ready services', () => {
    const args = {
      status: 'Ready',
      logPath: devLogPath('/a checkout/.cache/localhost-stack'),
      storybook: 'http://127.0.0.1:5802/',
      product: 'http://127.0.0.1:5800/',
    };
    const row = devStatusLine({ ...args, terminal: true });
    expect(row.replaceAll(/\x1b\]8;;.*?\x1b\\/g, '')).toBe(
      'Ready · Logs · Storybook · Product'
    );
    expect(row).toContain(
      'file:///a%20checkout/.cache/localhost-stack/dev.log'
    );
    expect(row).toContain(args.product);
    expect(row).toContain(args.storybook);
    expect(devStatusLine({ ...args, terminal: false })).toBe(
      'Ready · Logs file:///a%20checkout/.cache/localhost-stack/dev.log · Storybook http://127.0.0.1:5802/ · Product http://127.0.0.1:5800/'
    );
  });
});
