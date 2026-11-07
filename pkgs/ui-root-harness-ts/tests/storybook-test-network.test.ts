import { expect, test } from 'bun:test';
import { storybookNetwork, storybookTestNetwork } from '../storybook/network';

// regression: storybook-test-worktree-port-collision
test('independent test checkouts keep their assigned ports', () => {
  expect(storybookTestNetwork({ STORYBOOK_TEST_PORT: '6280' })).toEqual({
    host: '127.0.0.1',
    port: 6280,
  });
  expect(storybookTestNetwork({ STORYBOOK_TEST_PORT: '6289' })).toEqual({
    host: '127.0.0.1',
    port: 6289,
  });
});

test('test and development ports have independent defaults', () => {
  expect(storybookTestNetwork({ STORYBOOK_PORT: '6289' }).port).toBe(6007);
  expect(storybookNetwork({ STORYBOOK_TEST_PORT: '6289' }).port).toBe(6006);
});

test.each(['0', '80', '65536', '6280.5', '6280junk'])(
  'invalid test port %s fails before starting a server',
  (port) => {
    expect(() => storybookTestNetwork({ STORYBOOK_TEST_PORT: port })).toThrow(
      'STORYBOOK_TEST_PORT must be an integer between 1024 and 65535'
    );
  }
);
