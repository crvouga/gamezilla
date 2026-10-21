import { describe, expect, test } from 'bun:test';

import {
  ModerationProvider,
  useModeration,
} from '@libs/moderation-client-ts/moderation-context';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import { moderationRulesOver } from '@libs/moderation-shared-ts/moderation-rules';
import type { TeamRule } from '@libs/moderation-shared-ts/policy';
import { createRoot } from 'solid-js';

describe('ModerationProvider', () => {
  test('a rule change re-judges a name already on screen', () => {
    let rules: readonly TeamRule[] = [];
    const listeners = new Set<() => void>();
    const moderation = moderationRulesOver({
      rules: () => rules,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    });
    let label: (() => string) | undefined;
    const dispose = createRoot((done) => {
      ModerationProvider({
        rules: moderation,
        get children() {
          const current = useModeration();
          label = () => usernameLabel(current(), 'chess_cheater', 'p1');
          return null;
        },
      });
      return done;
    });
    expect(label?.()).toBe('@chess_cheater');
    rules = [{ kind: 'username', name: 'chess_cheater', sinceMs: 0 }];
    for (const listener of listeners) listener();
    expect(label?.()).not.toBe('@chess_cheater');
    dispose();
    expect(listeners.size).toBe(0);
  });

  test('a screen outside the provider fails loudly', () => {
    createRoot((done) => {
      expect(() => useModeration()).toThrow(/no ModerationProvider/);
      done();
    });
  });
});
