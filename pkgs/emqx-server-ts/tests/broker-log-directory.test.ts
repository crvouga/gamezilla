import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { brokerLogDirectory } from '@pkgs/emqx-server-ts/broker-log-directory';

// regression: emqx-space-in-crash-dump-path
test('a workspace on a volume whose name has spaces uses an isolated whitespace-free broker log directory', () => {
  const data = '/Volumes/External Drive 2/project/pkgs/emqx-server-ts/data';
  const path = brokerLogDirectory(data, '/tmp');
  expect(path).not.toMatch(/\s/);
  expect(path.startsWith(join('/tmp', 'emqx-log-'))).toBe(true);
  expect(brokerLogDirectory(data, '/tmp')).toBe(path);
  expect(brokerLogDirectory(`${data}-other`, '/tmp')).not.toBe(path);
  expect(brokerLogDirectory('/workspace/data', '/tmp')).toBe(
    join('/workspace/data', 'log')
  );
});
