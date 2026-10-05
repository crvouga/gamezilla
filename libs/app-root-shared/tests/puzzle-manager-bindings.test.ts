import { expect, test } from 'bun:test';
import {
  ConfigurationError,
  readPuzzleManagerAccountIds,
} from '@libs/app-root-shared/env';

test('reads a deterministic puzzle manager allowlist from the environment', () => {
  expect(
    readPuzzleManagerAccountIds({
      PUZZLE_MANAGER_ACCOUNT_IDS: '[" beta ","alpha","beta"]',
    })
  ).toEqual(['alpha', 'beta']);
  expect(readPuzzleManagerAccountIds({})).toEqual([]);
});

test('refuses malformed puzzle manager bindings', () => {
  for (const value of ['not-json', '{}', '["", 42]']) {
    expect(() =>
      readPuzzleManagerAccountIds({ PUZZLE_MANAGER_ACCOUNT_IDS: value })
    ).toThrow(ConfigurationError);
  }
});
