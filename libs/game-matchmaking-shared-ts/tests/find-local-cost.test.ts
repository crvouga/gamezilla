import { expect, test } from 'bun:test';
import { localFind } from './find-local-fixture';

// regression: local-find-repeats-permission-reads
test('a signed-in host checks a local Find with one grant snapshot', async () => {
  const result = await localFind({ presence: 'host' });
  expect(result.code).toBeNull();
  expect(
    result.statements.filter((text) => text.includes('FROM client_config'))
  ).toHaveLength(1);
  expect(
    result.statements.filter((text) =>
      text.includes('FROM billing_subscriptions')
    )
  ).toHaveLength(1);
  expect(
    result.statements.filter((text) =>
      text.includes('FROM chess_opponent_searches')
    )
  ).toHaveLength(1);
  expect(result.statements).toHaveLength(4);
  expect(
    result.statements.every((text) => text.trimStart().startsWith('SELECT'))
  ).toBe(true);
});

test('the Find gates retain their existing first refusal and space policy', async () => {
  for (const [input, code] of [
    [
      {
        presence: 'absent',
        waiting: true,
        unfinished: true,
        control: 'invalid',
      },
      'CHESS_ALREADY_LOOKING',
    ],
    [
      { presence: 'absent', unfinished: true, control: 'invalid' },
      'CHESS_SPACE_REQUIRED',
    ],
    [
      { presence: 'guest', unfinished: true, control: 'invalid' },
      'not_granted',
    ],
    [
      { presence: 'host', unfinished: true, control: 'invalid' },
      'CHESS_TIME_CONTROL_NOT_OFFERED',
    ],
    // The unfinished game limit is the server's to refuse, so the refusal
    // stays with the device and offers the way back to the game
    // (specs/games/unfinished-game-return.feature); a screen asks the same
    // decision before it sends.
    [{ presence: 'host', unfinished: true }, null],
  ] as const)
    expect((await localFind(input)).code).toBe(code);
});

test('a stale projection still rechecks accepted waiting state and the fresh limit under the owner lock', async () => {
  const result = await localFind({
    presence: 'host',
    authoritativeWaiting: true,
  });
  expect(result.code).toBe('CHESS_ALREADY_LOOKING');
  const lockAt = result.statements.findIndex((text) =>
    text.includes('INSERT INTO matchmaking_owners')
  );
  const waitingAt = result.statements.findIndex((text) =>
    text.includes('SELECT id FROM matchmaking_waiting')
  );
  const limitAt = result.statements.findIndex((text) =>
    text.includes('SELECT id FROM chess_multiplayer_games')
  );
  expect(lockAt).toBeGreaterThanOrEqual(0);
  expect(limitAt).toBeGreaterThan(lockAt);
  expect(waitingAt).toBeGreaterThan(limitAt);
  expect(
    result.statements
      .slice(lockAt + 1)
      .filter((text) => text.includes('FROM client_config'))
  ).toHaveLength(1);
});
