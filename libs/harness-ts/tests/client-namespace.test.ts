import { expect, test } from 'bun:test';
import { createHarnessClientNamespaces } from '@libs/harness-ts/client-namespace';

test('another harness cannot change an existing device namespace', () => {
  // regression: concurrent-harness-client-epoch
  const first = createHarnessClientNamespaces();
  const alice = first.namespace('alice');
  const second = createHarnessClientNamespaces();
  expect(second.namespace('alice')).not.toBe(alice);
  expect(first.namespace('alice')).toBe(alice);
  second.bump();
  expect(first.namespace('alice')).toBe(alice);
  const bob = first.namespace('bob');
  first.bump();
  expect(first.namespace('alice')).not.toBe(alice);
  expect(first.namespace('bob')).not.toBe(bob);
});
