import { expect, test } from 'bun:test';
import { brokerLogDirectory } from '@pkgs/emqx-server/broker-log-directory';

// regression: emqx-space-in-crash-dump-path
test('a workspace on OWC Express uses an isolated whitespace-free broker log directory', () => {
  const data = '/Volumes/OWC Express 1M2/project/pkgs/emqx-server/data';
  const path = brokerLogDirectory(data, '/tmp');
  expect(path).not.toMatch(/\s/);
  expect(path.startsWith('/tmp/emqx-log-')).toBe(true);
  expect(brokerLogDirectory(data, '/tmp')).toBe(path);
  expect(brokerLogDirectory(`${data}-other`, '/tmp')).not.toBe(path);
  expect(brokerLogDirectory('/workspace/data', '/tmp')).toBe(
    '/workspace/data/log'
  );
});
