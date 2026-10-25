import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { GameSide, TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import { CustomGameAvailableAttr } from './custom-game-availability';
import { soloCustomGame } from './custom-game-local';
import { CustomGamesAttr } from './custom-game-state';
import type { SimulationSessionView } from './simulation-session-runtime';

/** A command is decided against the current live mechanics on the room's serial chain. */
export function projectCustomSimulation(
  state: RoomState,
  position: string,
  execution: SimulationExecution
): RoomState {
  const games = CustomGamesAttr.from(state);
  if (games.current === null) return state;
  return {
    ...state,
    ...CustomGamesAttr({
      ...games,
      current: { ...games.current, fen: position, execution },
    }),
  };
}

/** Local games have one device owner; shared games use the room's admitted roster. */
export function selectCustomSimulation(
  state: RoomState,
  rules: TurnGames,
  owner: string | null
): SimulationSessionView | null {
  const current = CustomGamesAttr.from(state).current;
  if (current === null) return null;
  const simulation = rules.simulation(rules.forPosition(current.fen).id);
  const local = soloCustomGame(current, rules);
  if (
    simulation === undefined ||
    local !== (owner !== null) ||
    (local && current.creator !== owner)
  )
    return null;
  const controllers = new Map<GameSide, string>();
  const bots: SimulationSessionView['bots'][number][] = [];
  for (const side of current.sides) {
    if (current[side].kind === 'person')
      controllers.set(side, current[side].person);
    if (current[side].kind === 'local' && local)
      controllers.set(side, current.creator);
    if (current[side].kind === 'bot')
      bots.push({ side, difficulty: current.difficulty[side] });
  }
  return {
    id: current.id,
    active: current.status === 'active',
    available: local || CustomGameAvailableAttr.from(state),
    position: current.fen,
    simulation,
    controllers,
    bots,
    execution: current.execution,
  };
}
