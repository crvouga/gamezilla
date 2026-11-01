import { expect, test } from 'bun:test';
import { storybookNetwork } from '../storybook/network';

// regression: storybook-remote-localhost
test('local is loopback, LAN is explicit, and named forwards are allow-listed', () => {
  expect(storybookNetwork({}).host).toBe('127.0.0.1');
  const remote = storybookNetwork({
    STORYBOOK_HOST: '0.0.0.0',
    STORYBOOK_PORT: '5382',
    STORYBOOK_ORIGIN: 'https://preview.example.test:8443',
    STORYBOOK_ALLOWED_HOSTS: 'studio.local',
  });
  expect(remote.host).toBe('0.0.0.0');
  expect(remote.port).toBe(5382);
  expect(remote.allowedHosts).toContain('preview.example.test');
  expect(remote.allowedHosts).toContain('studio.local');
});

test.each(['abc', '0', '65536', '6006.5'])(
  'invalid Storybook port %s fails explicitly',
  (port) => {
    expect(() => storybookNetwork({ STORYBOOK_PORT: port })).toThrow(
      'STORYBOOK_PORT'
    );
  }
);

test.each(['*', '.example.test', 'https://studio.local'])(
  'host allowlist rejects %s',
  (host) => {
    expect(() => storybookNetwork({ STORYBOOK_ALLOWED_HOSTS: host })).toThrow(
      'STORYBOOK_ALLOWED_HOSTS'
    );
  }
);

test.each([
  'ftp://preview.test',
  'https://user:secret@preview.test',
  'https://preview.test/path',
])('public origin rejects %s', (origin) => {
  expect(() => storybookNetwork({ STORYBOOK_ORIGIN: origin })).toThrow(
    'STORYBOOK_ORIGIN'
  );
});
