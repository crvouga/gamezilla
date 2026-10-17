import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { backToTabs } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { configureCustomGame, readCustomGameProbe } from './custom-game-ui';
import { showCustomGames } from './game-navigation';
import { harnessGameOf } from './harness-game-of';

/** Who takes each side: a person by name, a bot, or nobody yet. */
export type CustomGameSeat = string | 'bot' | 'open';

/** A custom game of any game, reached through ordinary choices only. */
export type CustomGameLineup = {
  readonly host?: string;
  readonly first?: CustomGameSeat;
  readonly second?: CustomGameSeat;
  readonly watchers?: readonly string[];
  /** Every person in it agrees to start (default). */
  readonly ready?: boolean;
  /** It is started (default). */
  readonly active?: boolean;
  /** Moves played from the start, alternating sides. */
  readonly moves?: readonly string[];
};

const SIDES: readonly CustomGameSide[] = ['white', 'black'];

function isPerson(seat: CustomGameSeat): boolean {
  return seat !== 'bot' && seat !== 'open';
}

async function seat(
  s: ProductHarness,
  host: string,
  side: CustomGameSide,
  person: CustomGameSeat
): Promise<void> {
  if (person === 'open') return;
  if (person === 'bot') {
    await configureCustomGame(s, host, { operation: 'bot', side });
    return;
  }
  if (person === host) {
    await configureCustomGame(s, host, { operation: 'take', side });
    return;
  }
  const id = (await readCustomGameProbe(s, person))?.myId;
  if (!id) throw new Error(`No identity for ${person}`);
  await configureCustomGame(s, host, { operation: 'invite', side, person: id });
  await configureCustomGame(s, person, { operation: 'accept', side });
}

/** Play `moves` by whoever has each turn, through the participants' choices. */
export async function playCustomGameMoves(
  s: ProductHarness,
  observer: string,
  seats: Readonly<Record<CustomGameSide, CustomGameSeat>>,
  moves: readonly string[]
): Promise<void> {
  for (const move of moves) {
    const game = (await readCustomGameProbe(s, observer))?.current;
    if (game === null || game === undefined) throw new Error('No game');
    const mover = seats[game.turn];
    if (!isPerson(mover))
      throw new Error(`The ${game.turn} side has no person to play ${move}`);
    await configureCustomGame(s, mover, {
      operation: 'move',
      uci: move,
      ply: game.moves.length,
    });
  }
}

/** Preconditions use ordinary space and game choices, never inject a board or a winner. */
export const establishCustomGame = scenarioAction({
  name: 'establishCustomGame',
  act: async (s, gameId: string, lineup: CustomGameLineup = {}) => {
    const game = harnessGameOf(s, gameId);
    const host = lineup.host ?? 'alice';
    const seats = {
      white: lineup.first ?? 'alice',
      black: lineup.second ?? 'bob',
    };
    const people = [
      ...new Set([host, seats.white, seats.black, ...(lineup.watchers ?? [])]),
    ].filter(isPerson);
    for (const person of people) {
      await Promise.resolve(signInWithGoogle.act(s, person));
      await Promise.resolve(backToTabs.act(s, person));
    }
    await Promise.resolve(createSpace.act(s, host));
    const link = await readSpaceLink(s, host);
    if (link === null) throw new Error(`${game.label}: the host has no space`);
    await showCustomGames(s, host, game.shared.id);
    for (const person of people.filter((p) => p !== host)) {
      // regression: connect-four-fixture-before-space-join
      await Promise.resolve(openSpaceLink.act(s, person, link));
      await (await actorUi(s, person)).get('space-join').expect.visible();
      await Promise.resolve(joinFromPrompt.act(s, person));
      await showCustomGames(s, person, game.shared.id);
    }
    await configureCustomGame(s, host, {
      operation: 'create',
      game: game.shared.id,
    });
    await configureCustomGame(s, host, { operation: 'open', side: 'white' });
    for (const side of SIDES) await seat(s, host, side, seats[side]);
    // Changing either side withdraws all readiness, so agree to the final lineup.
    if (lineup.ready !== false)
      for (const side of SIDES)
        if (isPerson(seats[side]))
          await configureCustomGame(s, seats[side], { operation: 'ready' });
    if (lineup.active !== false)
      await configureCustomGame(s, host, { operation: 'start' });
    await playCustomGameMoves(s, host, seats, lineup.moves ?? []);
  },
});
