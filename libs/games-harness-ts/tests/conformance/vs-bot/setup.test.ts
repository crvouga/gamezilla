import { expect, test } from 'bun:test';
import { ChangeGameSession } from '@libs/game-session-shared-ts/game-session-commands';
import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import { GamesRoomAttr } from '@libs/spaces-shared-ts/games';
import { SpaceMembersRoomAttr } from '@libs/spaces-shared-ts/space-members-messages';
import { createSpaceModule } from '@libs/spaces-shared-ts/space-module';
import { assertRoomModuleName } from '@pkgs/room-root-shared-ts/types';
import { forEveryGame } from '../game-suite';

forEveryGame(import.meta.path, (game) => {
  test('one person opens setup with a bot in each opposing seat', () => {
    const room = createSpaceModule(
      assertRoomModuleName('bot-setup'),
      [game.shared],
      {
        now: () => 0,
        random: () => 0,
        authority: true,
      }
    );
    const state = {
      ...room.initialState(),
      ...GamesRoomAttr.selected(game.shared.id),
      ...SpaceMembersRoomAttr.seats({ alice: { joinedAt: '2026-10-23' } }),
    };
    const result = room.handle(
      state,
      {
        id: 'new-bot-game',
        ts: 0,
        payload: ChangeGameSession({
          operation: 'create',
          mode: 'vs-bot',
          gameId: null,
          revision: 0,
        }),
      },
      'alice'
    );
    if (!result.ok) throw new Error(JSON.stringify(result.error));
    const session = GameSessionsAttr.from(
      result.events.reduce((s, e) => room.reduce(s, e), state)
    ).current;
    expect(session?.mode).toBe('vs-bot');
    expect(session?.status).toBe('configuring');
    expect(session?.white.person).toBe('alice');
    expect(session?.sides.slice(1).map((side) => session[side].kind)).toEqual(
      session?.sides.slice(1).map(() => 'bot')
    );
  });
});
