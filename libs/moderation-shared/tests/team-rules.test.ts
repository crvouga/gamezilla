import { describe, expect, test } from 'bun:test';

import {
  spaceTitleText,
  standInName,
  usernameLabel,
} from '@libs/moderation-shared/display';
import {
  moderationRulesOver,
  shippedModerationRules,
} from '@libs/moderation-shared/moderation-rules';
import type { TeamRule } from '@libs/moderation-shared/policy';

function rulesOf(initial: readonly TeamRule[]) {
  let rules = initial;
  const listeners = new Set<() => void>();
  return {
    set(next: readonly TeamRule[]) {
      rules = next;
      for (const listener of listeners) listener();
    },
    moderation: moderationRulesOver({
      rules: () => rules,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  };
}

describe('team rules', () => {
  test('a username the team stops allowing is refused and shows its stand-in name', () => {
    const team = rulesOf([]);
    expect(
      usernameLabel(team.moderation.current(), 'chess_cheater', 'p1')
    ).toBe('@chess_cheater');
    team.set([{ kind: 'username', name: 'chess_cheater', sinceMs: 10 }]);
    const now = team.moderation.current();
    expect(now.checkWrite('username', 'Chess_Cheater').allowed).toBe(false);
    expect(usernameLabel(now, 'chess_cheater', 'p1')).toBe(standInName('p1'));
    expect(now.checkWrite('spaceTitle', 'chess_cheater').allowed).toBe(true);
  });

  test('starting to allow a name again shows it as it was', () => {
    const team = rulesOf([
      { kind: 'spaceTitle', name: 'Cheater corner', sinceMs: 0 },
    ]);
    expect(
      spaceTitleText(team.moderation.current(), 'cheater  Corner ', 's1')
    ).toBeNull();
    team.set([]);
    expect(
      spaceTitleText(team.moderation.current(), 'Cheater corner', 's1')
    ).toBe('Cheater corner');
  });

  test('a write is judged by the rules of the time it was made', () => {
    const team = rulesOf([
      { kind: 'spaceTitle', name: 'Cheater corner', sinceMs: 100 },
    ]);
    expect(
      team.moderation.at(99).checkWrite('spaceTitle', 'Cheater corner').allowed
    ).toBe(true);
    expect(
      team.moderation.at(100).checkWrite('spaceTitle', 'Cheater corner').allowed
    ).toBe(false);
  });

  test('a change is announced to every subscriber', () => {
    const team = rulesOf([]);
    let heard = 0;
    const stop = team.moderation.subscribe(() => {
      heard += 1;
    });
    team.set([{ kind: 'username', name: 'x_y_z', sinceMs: 0 }]);
    stop();
    team.set([]);
    expect(heard).toBe(1);
  });

  test('the shipped rules refuse what the policy always refuses', () => {
    const shipped = shippedModerationRules();
    expect(shipped.current().checkWrite('username', 'admin').allowed).toBe(
      false
    );
    expect(shipped.at(0)).toBe(shipped.current());
  });
});
