import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { composeRoomModules } from '@libs/spaces-shared-ts/load-game-plugins';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { bots, rules } from './reference-game';

/** An empty application and an independent consumer of the public contract. */
export function isolatedFrameworkProof() {
  const empty = createTurnGames([]);
  const emptyRooms = composeRoomModules(
    [],
    () => 0,
    () => 0
  );
  const definition = defineGame({
    rules,
    capabilities: { 'custom-games': { bots } },
    turnAutomation: { choose: () => 'advance-token', perform: async () => {} },
  });
  const games = createTurnGames([definition.turnGame]);
  const rooms = composeRoomModules(
    [definition],
    () => 0,
    () => 0
  );
  const action = games
    .turnsForPosition('race:3')
    ?.play('race:3', 'advance-token', '', []);
  return {
    emptyGames: empty.games.length,
    emptyRooms: emptyRooms.length,
    emptyState: emptyRooms[0]?.initialState(),
    offered: games.offers('counting-race', 'custom-games'),
    matchmaking: games.offers('counting-race', 'matchmaking'),
    initial: games.byId('counting-race').initial(),
    roomCount: rooms.length,
    action,
  };
}
