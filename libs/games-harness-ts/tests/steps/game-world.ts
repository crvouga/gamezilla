import type { GameSessionLineup } from '@libs/game-session-harness-ts/game-session-lineup';
import {
  establishGameSession,
  returnToGameSessions,
} from '@libs/game-session-harness-ts/game-session-lineup';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import type {
  HarnessGame,
  TurnHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { backToTabs, focusActor } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { GameCapability } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  CONFORMANCE_GAMES,
  conformanceGameOf,
  turnConformanceGameOf,
} from '../conformance-world';

/** The game this run of the scenario is for. */
export function gameOf(w: HarnessWorld): HarnessGame {
  return conformanceGameOf(w.ctx.variant, w.ctx.scenarioName);
}

export function turnGameOf(w: HarnessWorld): TurnHarnessGame {
  return turnConformanceGameOf(w.ctx.variant, w.ctx.scenarioName);
}

/** Any other enrolled game offering `capability`. */
export function anotherGame(
  w: HarnessWorld,
  capability: GameCapability
): HarnessGame {
  const other = CONFORMANCE_GAMES.find(
    (game) =>
      game.shared.id !== gameOf(w).shared.id &&
      game.shared.registration.capabilities[capability] !== undefined
  );
  if (other === undefined)
    throw new Error(`No other game offers ${capability} to compare with`);
  return other;
}

/** Another real turn game, for scenarios that review its recorded moves. */
export function anotherTurnGame(
  w: HarnessWorld,
  capability: GameCapability
): TurnHarnessGame {
  const other = CONFORMANCE_GAMES.filter(isTurnHarnessGame).find(
    (game) =>
      game.shared.id !== gameOf(w).shared.id &&
      game.shared.registration.capabilities[capability] !== undefined
  );
  if (other === undefined)
    throw new Error(`No other turn game offers ${capability}`);
  return other;
}

/**
 * `person` is in `host`'s space: the host starts one if they are in none,
 * and anyone else not yet there joins it from its link.
 */
export async function joinHostsSpace(
  w: HarnessWorld,
  host: string,
  person: string
): Promise<void> {
  await w.s.apply(focusActor, host);
  if (!(await w.s.read(activeSpaceVisible, host))) {
    await w.s.apply(backToTabs, host);
    await w.s.apply(createSpace, host);
  }
  if (person === host) return;
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  await w.s.apply(focusActor, person);
  if ((await w.s.read(readSpaceLink, person)) === link) return;
  await w.s.apply(joinViaLink, person, link);
}

export async function view(w: HarnessWorld, actor = 'alice') {
  return w.s.read(gameSessionView, actor);
}

export type View = Awaited<ReturnType<typeof view>>;

/** A game session of the run's game, remembered as it was before the act. */
export async function setupGameSession(
  w: HarnessWorld,
  lineup: GameSessionLineup = {}
): Promise<void> {
  await w.s.apply(establishGameSession, gameOf(w).shared.id, lineup);
  const host = lineup.host ?? 'alice';
  w.memo.set('game-session-host', host);
  w.memo.set('game-session-link', await w.s.read(readSpaceLink, host));
  await rememberGameSession(w);
}

/** The link of the space the game session is in. */
export async function spaceLinkOf(w: HarnessWorld): Promise<string> {
  const remembered = w.memo.get('game-session-link');
  if (typeof remembered === 'string') return remembered;
  const link = await w.s.read(readSpaceLink, hostOf(w));
  if (link === null) throw new Error('The host is not in a space');
  w.memo.set('game-session-link', link);
  return link;
}

/** `actor`, in the space but away from its game sessions, returns to them. */
export async function backToGameSessions(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(
    returnToGameSessions,
    gameOf(w).shared.id,
    actor,
    await spaceLinkOf(w)
  );
}

/** The game session as it is now, remembered as it was before the act. */
export async function rememberGameSession(w: HarnessWorld): Promise<void> {
  w.memo.set('game-session-before', await view(w, hostOf(w)));
}

/** The host whose space the game session is in. */
export function hostOf(w: HarnessWorld): string {
  return String(w.memo.get('game-session-host') ?? 'alice');
}

export function before(w: HarnessWorld): View {
  const remembered = w.memo.get('game-session-before') as View | undefined;
  if (remembered === undefined) throw new Error('No game session set up');
  return remembered;
}

/** The side `actor` plays in what `seen` shows. */
export async function sideOf(
  w: HarnessWorld,
  actor: string
): Promise<'white' | 'black'> {
  const own = await view(w, actor);
  const game = own.current;
  if (game?.white.person === own.myId) return 'white';
  if (game?.black.person === own.myId) return 'black';
  throw new Error(`${actor} has no side`);
}

/** The game's own moves up to `ply`, as its rules replay them. */
export function positionAfter(
  w: HarnessWorld,
  moves: readonly string[],
  ply: number
): string {
  return turnGameOf(w).shared.turnGame.rules.replay(moves, ply);
}
