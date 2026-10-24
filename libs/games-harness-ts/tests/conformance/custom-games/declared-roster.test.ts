import { expect, test } from 'bun:test';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { ChangeCustomGame } from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { forEveryGame } from '../game-suite';

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

/** Exercise the real authority and event reducer for each declared roster. */
function session(game: HarnessGame) {
  const sides = gameSides(game.shared.turnGame.rules);
  const module = createSpaceModule(
    assertRoomModuleName('roster-contract'),
    [game.shared],
    { now: () => 0, random: () => 0, authority: true }
  );
  let state = {
    ...module.initialState(),
    ...GamesRoomAttr.selected(game.shared.id),
    ...SpaceMembersRoomAttr.seats(
      Object.fromEntries(
        PEOPLE.map((person) => [person, { joinedAt: '2026-10-23' }])
      )
    ),
  };
  let sequence = 0;
  const current = () => CustomGamesAttr.from(state).current!;
  const send = (actor: string, input: CustomGameInput) => {
    const result = module.handle(
      state,
      {
        id: `roster-${sequence++}`,
        ts: 0,
        payload: ChangeCustomGame({
          ...input,
          gameId: current()?.id ?? null,
          revision: current()?.revision ?? 0,
        }),
      },
      actor
    );
    if (result.ok)
      state = result.events.reduce(
        (next, event) => module.reduce(next, event),
        state
      );
    return result.ok;
  };
  const start = () => {
    expect(send('alice', { operation: 'create' })).toBe(true);
    for (const [index, side] of sides.entries())
      if (index > 0)
        expect(send(PEOPLE[index]!, { operation: 'claim', side })).toBe(true);
    for (const [index, side] of sides.entries()) {
      const setup = game.fixtures.setups?.[side];
      expect(
        send(PEOPLE[index]!, {
          operation: 'ready',
          ...(setup === undefined ? {} : { setup }),
        })
      ).toBe(true);
    }
    expect(send('alice', { operation: 'start' })).toBe(true);
  };
  return { current, send, start, sides };
}

forEveryGame(import.meta.path, (game) => {
  test('every declared seat is enforced by the authority through completion and replay', () => {
    const room = session(game);
    room.start();
    expect(room.current().sides).toEqual([...room.sides]);
    for (const [ply, action] of game.fixtures.firstSideVictory.entries()) {
      const side = room.current().turn;
      const mover = room.sides.indexOf(side);
      const before = room.current();
      expect(
        room.send(PEOPLE[(mover + 1) % room.sides.length]!, {
          operation: 'move',
          uci: action,
          ply,
        })
      ).toBe(false);
      expect(room.current()).toEqual(before);
      for (const uci of ply === 0
        ? game.fixtures.refusedOpenings
        : ['! invalid action']) {
        expect(
          room.send(PEOPLE[mover]!, {
            operation: 'move',
            uci: uci || 'invalid-action',
            ply,
          })
        ).toBe(false);
        expect(room.current()).toEqual(before);
      }
      expect(
        room.send(PEOPLE[mover]!, { operation: 'move', uci: action, ply })
      ).toBe(true);
      const accepted = room.current();
      expect(
        room.send(PEOPLE[mover]!, { operation: 'move', uci: action, ply })
      ).toBe(false);
      expect(room.current()).toEqual(accepted);
      expect(
        CustomGamesAttr.from(
          CustomGamesAttr({
            current: JSON.parse(JSON.stringify(accepted)),
            history: [],
          })
        ).current
      ).toEqual(accepted);
    }
    expect(room.current().status).toBe('completed');
    expect(room.current().outcome.startsWith('white wins')).toBe(true);
    const finished = room.current();
    expect(
      room.send('alice', {
        operation: 'move',
        uci: game.fixtures.firstSideVictory[0]!,
        ply: finished.moves.length,
      })
    ).toBe(false);
    expect(room.current()).toEqual(finished);
    expect(
      game.shared.turnGame.rules.replay(
        finished.moves.map((move) => move.uci),
        finished.moves.length
      )
    ).toBe(finished.fen);
  });
});
