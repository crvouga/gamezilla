import type { CustomGameLineup } from '@libs/game-session-harness/custom-game-lineup';
import {
  establishCustomGame,
  returnToCustomGames,
} from '@libs/game-session-harness/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness/custom-game-moves';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import type { GameCapability } from '@pkgs/turn-game-shared/game-rules';
import { CONFORMANCE_GAMES, conformanceGameOf } from '../conformance-world';

/** The game this run of the scenario is for. */
export function gameOf(w: HarnessWorld): HarnessGame {
  return conformanceGameOf(w.ctx.variant, w.ctx.scenarioName);
}

/** Any other enrolled game offering `capability`. */
export function anotherGame(
  w: HarnessWorld,
  capability: GameCapability
): HarnessGame {
  const other = CONFORMANCE_GAMES.find(
    (game) =>
      game.shared.id !== gameOf(w).shared.id &&
      game.shared.turnGame.capabilities[capability] !== undefined
  );
  if (other === undefined)
    throw new Error(`No other game offers ${capability} to compare with`);
  return other;
}

export async function view(w: HarnessWorld, actor = 'alice') {
  return w.s.read(customGameView, actor);
}

export type View = Awaited<ReturnType<typeof view>>;

/** A custom game of the run's game, remembered as it was before the act. */
export async function setupCustomGame(
  w: HarnessWorld,
  lineup: CustomGameLineup = {}
): Promise<void> {
  await w.s.apply(establishCustomGame, gameOf(w).shared.id, lineup);
  const host = lineup.host ?? 'alice';
  w.memo.set('custom-game-host', host);
  w.memo.set('custom-game-link', await w.s.read(readSpaceLink, host));
  await rememberCustomGame(w);
}

/** The link of the space the custom game is in. */
export async function spaceLinkOf(w: HarnessWorld): Promise<string> {
  const remembered = w.memo.get('custom-game-link');
  if (typeof remembered === 'string') return remembered;
  const link = await w.s.read(readSpaceLink, hostOf(w));
  if (link === null) throw new Error('The host is not in a space');
  w.memo.set('custom-game-link', link);
  return link;
}

/** `actor`, in the space but away from its custom games, returns to them. */
export async function backToCustomGames(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  await w.s.apply(
    returnToCustomGames,
    gameOf(w).shared.id,
    actor,
    await spaceLinkOf(w)
  );
}

/** The custom game as it is now, remembered as it was before the act. */
export async function rememberCustomGame(w: HarnessWorld): Promise<void> {
  w.memo.set('custom-game-before', await view(w, hostOf(w)));
}

/** The host whose space the custom game is in. */
export function hostOf(w: HarnessWorld): string {
  return String(w.memo.get('custom-game-host') ?? 'alice');
}

export function before(w: HarnessWorld): View {
  const remembered = w.memo.get('custom-game-before') as View | undefined;
  if (remembered === undefined) throw new Error('No custom game set up');
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
  return gameOf(w).shared.turnGame.rules.replay(moves, ply);
}
