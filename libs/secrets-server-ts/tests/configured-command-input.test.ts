import { expect, test } from 'bun:test';
import { configuredCommandInput } from '@libs/secrets-server-ts/configured-command-input';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('the fixture flag and command delimiter never become the executable', () => {
  // regression: committed-brand-rebuild
  expect(
    configuredCommandInput(['--fixture', '--', 'bun', 'test'], undefined)
  ).toEqual({ mode: 'fixture', command: ['bun', 'test'] });
  expect(configuredCommandInput(['--', 'bun', 'build'], undefined)).toEqual({
    mode: 'configured',
    command: ['bun', 'build'],
  });
  expect(() => configuredCommandInput(['--fixture', '--'], undefined)).toThrow(
    'missing command'
  );
  expect(() => configuredCommandInput(['bun'], 'unknown')).toThrow(
    'must be fixture or configured'
  );
});

test('configuration preparation preserves every requested command argument', () => {
  assertProperty(
    'configuration flags preserve child arguments',
    fc.property(fc.array(fc.string()), (args) => {
      const command = ['bun', ...args];
      expect(
        configuredCommandInput(['--fixture', '--', ...command], undefined)
      ).toEqual({ mode: 'fixture', command });
      expect(configuredCommandInput(['--', ...command], undefined)).toEqual({
        mode: 'configured',
        command,
      });
    })
  );
});
