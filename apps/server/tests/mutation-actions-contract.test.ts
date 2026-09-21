import { describe, expect, test } from 'bun:test';
import { APP_MUTATIONS } from '@apps/server/sync/app-mutations';
import { MUTATION_ACTIONS } from '@libs/permissions/public/mutation-actions';
import {
  ACTION,
  PERMISSION,
} from '@libs/permissions/public/permission-catalog';

const KNOWN_KEYS = new Set<string>([
  ...Object.values(PERMISSION),
  ...Object.values(ACTION),
  'public',
  'quota',
]);

describe('§22.6 every server mutation declares its action', () => {
  test('every registered mutation has a MUTATION_ACTIONS declaration', () => {
    const undeclared = Object.keys(APP_MUTATIONS).filter(
      (name) => MUTATION_ACTIONS[name] === undefined
    );
    expect(undeclared).toEqual([]);
  });

  test('every declaration names a catalogued action (or public / quota)', () => {
    const unknown = Object.entries(MUTATION_ACTIONS).filter(
      ([, declared]) => !KNOWN_KEYS.has(declared)
    );
    expect(unknown).toEqual([]);
  });

  test('no stale declarations for mutations that are not registered', () => {
    const stale = Object.keys(MUTATION_ACTIONS).filter(
      (name) => APP_MUTATIONS[name] === undefined
    );
    expect(stale).toEqual([]);
  });
});
