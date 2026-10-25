import { expect, test } from 'bun:test';
import { QUORIDOR_HILL_PLAYABLE } from '@libs/quoridor-harness-ts/quoridor-playable';
import {
  completeCustomGameParty,
  type PublicCustomGame,
} from '@libs/runtime-harness-ts/custom-game-party-journey';
import { delayedPartyHost } from './custom-game-party-fixture';

// regression: party-journey-replays-stale-peer-turn
test('the party waits for the last accepted turn before choosing the next person', async () => {
  const { host, players, moves } = delayedPartyHost();
  const result = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(moves.slice(0, 4)).toEqual(['e2', 'b5', 'e8', 'h5']);
  expect(result.status).toBe('completed');
  expect(result.outcome).not.toBe('');
  expect(result.ply).toBe(moves.length);
  expect(players).toEqual(
    players.map((_, i) => (i % 2 === 0 ? 'white' : 'black'))
  );
});

test('the recorded Hill position chooses a legal move past the occupied f5', () => {
  const game = QUORIDOR_HILL_PLAYABLE.shared;
  const actions = [
    'e2',
    'b5',
    'e8',
    'h5',
    'e3',
    'c5',
    'e7',
    'g5',
    'e4',
    'd4h',
    'e5v',
    'c5v',
    'f4',
    'c6',
    'e6',
    'f5',
  ];
  const position = game.turnGame.rules.replay(actions, actions.length);
  const action = game.automation.turns.choose(position, () => 0.25);
  expect(action).not.toBe('f5');
  expect(game.turnGame.rules.legal(position)).toContain(action!);
});

test('the party returns from review15 to live16 before choosing a human move', async () => {
  const { host, moves, returnsLive } = delayedPartyHost('reviewed');
  const result = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(returnsLive()).toBe(1);
  expect(moves.slice(0, 16)).toEqual([
    'e2',
    'b5',
    'e8',
    'h5',
    'e3',
    'c5',
    'e7',
    'g5',
    'e4',
    'd4h',
    'e5v',
    'c5v',
    'f4',
    'c6',
    'e6',
    'f5',
  ]);
  expect(moves[16]).toBe('f6');
  expect(result.status).toBe('completed');
  expect(result.ply).toBe(moves.length);
});

// regression: party-journey-chooses-before-bot-rebase
test('the party re-reads the acting board after Blue g6 rebases to f5', async () => {
  const { host, moves, rebased } = delayedPartyHost('rebased');
  const result = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(rebased()).toBe(true);
  expect(moves.slice(0, 16).join(',')).toBe(
    'e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6,f5'
  );
  expect(moves[16]).toBe('f6');
  expect(result.status).toBe('completed');
  expect(result.ply).toBe(moves.length);
});

test('both provisional g6 and authoritative f5 are real bot choices', () => {
  const game = QUORIDOR_HILL_PLAYABLE.shared;
  const actions = 'e2,b5,e8,h5,e3,c5,e7,g5,e4,d4h,e5v,c5v,f4,c6,e6'.split(',');
  const position = game.turnGame.rules.replay(actions, actions.length);
  expect(game.automation.turns.choose(position, () => 0.25)).toBe('g6');
  expect(game.automation.turns.choose(position, () => 0.75)).toBe('f5');
  const provisional = game.turnGame.rules.play(position, 'g6', '', actions)!;
  expect(game.automation.turns.choose(provisional.position, () => 0.25)).toBe(
    'f5'
  );
});

test('the party reselects a pending acting board without repeating a move', async () => {
  const fixture = delayedPartyHost();
  let delayed = false;
  const host = {
    ...fixture.host,
    act: async (
      name: string,
      gestures: Parameters<typeof fixture.host.act>[1]
    ) => {
      await fixture.host.act(name, gestures);
      if (
        name === 'readPartyBoard' &&
        fixture.moves.length === 16 &&
        !delayed
      ) {
        fixture.setReady(false);
        delayed = true;
      } else if (name === 'playPartyMove' && delayed) fixture.setReady(true);
    },
  };
  const finished = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(delayed).toBe(true);
  expect(fixture.returnsLive()).toBe(1);
  expect(finished.status).toBe('completed');
  expect(fixture.players).toHaveLength(10);
});

test('the party observes completion received when the acting device activates', async () => {
  const fixture = delayedPartyHost();
  let completedElsewhere = false;
  const host = {
    ...fixture.host,
    act: async (
      name: string,
      gestures: Parameters<typeof fixture.host.act>[1]
    ) => {
      await fixture.host.act(name, gestures);
      if (
        name === 'readPartyBoard' &&
        fixture.moves.length === 16 &&
        !completedElsewhere
      ) {
        for (const action of ['f5', 'c7', 'e5']) fixture.externalMove(action);
        completedElsewhere = true;
      }
    },
  };
  const finished = await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  expect(completedElsewhere).toBe(true);
  expect(finished.status).toBe('completed');
  expect(finished.ply).toBe(19);
  expect(fixture.players).toHaveLength(8);
});

test('a failed party gesture retains its cause and bounded public board context', async () => {
  const fixture = delayedPartyHost();
  const cause = new Error('detached board');
  const host = {
    ...fixture.host,
    act: (name: string, gestures: Parameters<typeof fixture.host.act>[1]) =>
      fixture.host.act(name, (ui) =>
        gestures({
          ...ui,
          get: (id) => {
            const node = ui.get(id);
            if (id.startsWith('custom-game-board-action-'))
              return {
                ...node,
                wait: async () => {
                  throw cause;
                },
              };
            if (id !== 'custom-game-public') return node;
            return {
              ...node,
              attribute: async (attribute: string) =>
                JSON.stringify({
                  ...(JSON.parse(
                    (await node.attribute(attribute))!
                  ) as PublicCustomGame),
                  outcome: 'outcome'.repeat(1000),
                  extra: 'EXTRA_SENTINEL'.repeat(1000),
                }),
            };
          },
        })
      ),
  };
  let failure: unknown;
  try {
    await completeCustomGameParty(host, QUORIDOR_HILL_PLAYABLE);
  } catch (caught) {
    failure = caught;
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).cause).toBe(cause);
  const message = (failure as Error).message;
  expect(message).toContain('Party action e2; chosen');
  expect(message).toContain('; latest');
  expect(message).not.toContain('EXTRA_SENTINEL');
  expect(message.length).toBeLessThan(1500);
});
