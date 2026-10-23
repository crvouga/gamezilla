import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import {
  ChangeCustomGame,
  EndCustomGameOnTime,
} from '@libs/game-session-shared-ts/custom-game-commands';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import type { Message } from '@pkgs/message-shared-ts/message';
import { ROOM_SCHEDULER_IDENTITY } from '@pkgs/room-root-shared-ts/builtin';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import type { GameRules } from '@pkgs/turn-game-shared-ts/game-rules';

const sides = ['white', 'black', 'red', 'blue'] as const;
const rules: GameRules = {
  id: 'four-seat-race',
  sides,
  recognizes: (position) => /^four-seat-race:[0-5]$/.test(position),
  initial: () => 'four-seat-race:0',
  play(position, action) {
    const count = Number(position.split(':')[1]);
    if (count >= 5 || action !== 'advance') return null;
    return {
      position: `four-seat-race:${count + 1}`,
      history: String(count + 1),
      turn: sides[(count + 1) % sides.length]!,
      label: String(count + 1),
      winner: count === 4 ? 'white' : null,
      reason: count === 4 ? 'finish line' : null,
    };
  },
  replay: (_actions, ply) => `four-seat-race:${ply}`,
  legal: (position) => (position.endsWith(':5') ? [] : ['advance']),
  canWin: () => true,
  moves: () => [],
};

export const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

/** A separate four-seat consumer, through the same public room command boundary. */
export function fourSeatRoom() {
  const definition = defineTurnGame({
    rules,
    capabilities: {
      'custom-games': { bots: { difficulties: [], choose: () => 'advance' } },
    },
    automation: { choose: () => 'advance', perform: async () => {} },
  });
  const module = createSpaceModule(
    assertRoomModuleName('four-seat-room'),
    [definition],
    { now: () => 0, random: () => 0, authority: true }
  );
  let state = {
    ...module.initialState(),
    ...GamesRoomAttr.selected(rules.id),
    ...SpaceMembersRoomAttr.seats(
      Object.fromEntries(
        PEOPLE.map((person) => [person, { joinedAt: '2026-10-23' }])
      )
    ),
  };
  let sequence = 0;
  const current = () => CustomGamesAttr.from(state).current!;
  const deliver = (actor: string, payload: Message, at = 0) => {
    const result = module.handle(
      state,
      { id: `four-${sequence++}`, ts: at, payload },
      actor
    );
    if (result.ok)
      state = result.events.reduce(
        (next, event) => module.reduce(next, event),
        state
      );
    return result;
  };
  const send = (actor: string, input: CustomGameInput, at = 0) =>
    deliver(
      actor,
      ChangeCustomGame({
        ...input,
        gameId: current()?.id ?? null,
        revision: current()?.revision ?? 0,
      }),
      at
    );
  const fill = () => {
    send('alice', { operation: 'create' });
    for (const [index, side] of sides.entries()) {
      if (index > 0) send(PEOPLE[index]!, { operation: 'claim', side });
    }
    for (const person of PEOPLE) send(person, { operation: 'ready' });
  };
  const expire = (at: number) =>
    deliver(
      ROOM_SCHEDULER_IDENTITY,
      EndCustomGameOnTime({
        gameId: current().id,
        side: current().turn,
        ply: current().moves.length,
      }),
      at
    );
  return { current, send, fill, expire };
}
