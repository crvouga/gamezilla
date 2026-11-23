import { describe, expect, test } from 'bun:test';
import { appLink, devLine, devLogPath, storybookLink } from './dev-links';

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

  test('each line is a label and one address', () => {
    expect(devLine('App', 'http://127.0.0.1:5484/')).toBe(
      'App        http://127.0.0.1:5484/\n'
    );
    expect(devLine('Storybook', 'x')).toBe('Storybook  x\n');
    expect(devLogPath('/repo/.cache/localhost-stack')).toBe(
      '/repo/.cache/localhost-stack/dev.log'
    );
  });
});
