import type { CustomGameLineup } from '@libs/game-session-harness/custom-game-lineup';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness/custom-game-moves';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import { HARNESS_GAMES } from '@libs/games-harness/harness-games';
import type { HarnessWorld } from '@libs/harness/spec-world';
import type { GameCapability } from '@pkgs/turn-game-shared/game-rules';

/**
 * What each shared feature shows, so it runs only for the games offering
 * it. A feature missing here fails rather than running for nobody.
 */
const SHOWN: Readonly<Record<string, readonly GameCapability[]>> = {
  'game-choices': ['custom-games', 'matchmaking', 'history'],
  'custom-games': ['custom-games'],
  'game-turns': ['custom-games'],
  'finding-an-opponent': ['matchmaking'],
  'game-history': ['custom-games', 'history'],
};

export function capabilitiesShown(
  featureUri: string
): readonly GameCapability[] {
  const stem = featureUri.replace(/^.*\//, '').replace(/\.feature$/, '');
  const shown = SHOWN[stem];
  if (shown === undefined)
    throw new Error(`${featureUri}: say which capabilities it shows`);
  return shown;
}

/** The game this run of the scenario is for. */
export function gameOf(w: HarnessWorld): HarnessGame {
  const id = w.ctx.variant?.id;
  const game = HARNESS_GAMES.find((candidate) => candidate.shared.id === id);
  if (game === undefined)
    throw new Error(`${w.ctx.scenarioName}: no game for this run`);
  return game;
}

/** Any other enrolled game offering `capability`. */
export function anotherGame(
  w: HarnessWorld,
  capability: GameCapability
): HarnessGame {
  const other = HARNESS_GAMES.find(
    (game) =>
      game.shared.id !== gameOf(w).shared.id &&
      game.shared.turnGame.capabilities.includes(capability)
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
  w.memo.set('custom-game-before', await view(w));
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
