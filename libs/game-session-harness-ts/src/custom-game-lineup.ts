import { hostedSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  reopenSpaceLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { readCustomGameProbe } from './custom-game-probe';
import { configureCustomGame } from './custom-game-ui';
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
  /** The clock choice the creator makes before anyone agrees (default: untimed). */
  readonly clock?: { readonly minutes: number; readonly increment: number };
  /** Every person in it agrees to start (default). */
  readonly ready?: boolean;
  /** It is started (default). */
  readonly active?: boolean;
  /** Moves played from the start, alternating sides. */
  readonly moves?: readonly string[];
  /** A side's private setup other than the game's known one, for a game with private setups. */
  readonly setups?: Partial<Record<CustomGameSide, string>>;
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

/** `person` signs in with Google, unless their device already has an account. */
async function signIn(s: ProductHarness, person: string): Promise<void> {
  if ((await signedInAccountOf(s, person)) === null)
    await Promise.resolve(signInWithGoogle.act(s, person));
  await Promise.resolve(backToTabs.act(s, person));
}

/** `person` comes into `link`'s space at the game's custom games. */
async function enterCustomGames(
  s: ProductHarness,
  gameId: string,
  person: string,
  link: string
): Promise<void> {
  // regression: connect-four-fixture-before-space-join
  await Promise.resolve(openSpaceLink.act(s, person, link));
  await (await actorUi(s, person)).get('space-join').expect.visible();
  await Promise.resolve(joinFromPrompt.act(s, person));
  await showCustomGames(s, person, gameId);
}

/** Who joins whose space, for the game's custom games, signed in or not. */
type Joining = {
  readonly gameId: string;
  readonly host: string;
  readonly person: string;
  readonly guest: boolean;
};

async function join(s: ProductHarness, joining: Joining): Promise<void> {
  const { gameId, host, person } = joining;
  if (s.actors.has(person) && (await readCustomGameProbe(s, person)) !== null)
    return;
  const link = await readSpaceLink(s, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  if (!joining.guest) await signIn(s, person);
  await enterCustomGames(s, gameId, person, link);
}

/**
 * `person` joins `host`'s space from its link and opens the game's custom
 * games, as anyone the host shares the link with does; someone already
 * shown them stays as they are.
 */
export const joinCustomGames = scenarioAction({
  name: 'joinCustomGames',
  act: (s, gameId: string, host: string, person: string) =>
    join(s, { gameId, host, person, guest: false }),
});

/** {@link joinCustomGames} as a guest, who has not signed in. */
export const joinCustomGamesAsGuest = scenarioAction({
  name: 'joinCustomGamesAsGuest',
  act: (s, gameId: string, host: string, person: string) =>
    join(s, { gameId, host, person, guest: true }),
});

/**
 * `person`, in the space at `link` but away from its custom games (on
 * another tab, back from signing in or reopening the app), returns to them;
 * someone already shown them stays as they are.
 */
export const returnToCustomGames = scenarioAction({
  name: 'returnToCustomGames',
  act: async (s, gameId: string, person: string, link: string) => {
    if ((await readCustomGameProbe(s, person)) !== null) return;
    await Promise.resolve(reopenSpaceLink.act(s, person, link));
    await showCustomGames(s, person, gameId);
  },
});

/** Every person seated agrees, each with the setup the lineup names, if any. */
async function readyEveryPerson(
  s: ProductHarness,
  seats: Record<CustomGameSide, CustomGameSeat>,
  lineup: CustomGameLineup
): Promise<void> {
  for (const side of SIDES) {
    if (!isPerson(seats[side])) continue;
    const setup = lineup.setups?.[side];
    await configureCustomGame(s, seats[side], {
      operation: 'ready',
      ...(setup === undefined ? {} : { setup }),
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
    for (const person of people) await signIn(s, person);
    // A host already hosting a space plays in it.
    const hosted = await hostedSpaceId(s, host);
    if (hosted === null) await Promise.resolve(createSpace.act(s, host));
    else {
      await s.actors.get(host)!.openLink(`/space/${hosted}`);
      await s.session.waitForIdle();
    }
    const link = await readSpaceLink(s, host);
    if (link === null) throw new Error(`${game.label}: the host has no space`);
    await showCustomGames(s, host, game.shared.id);
    for (const person of people.filter((p) => p !== host))
      await enterCustomGames(s, game.shared.id, person, link);
    await configureCustomGame(s, host, {
      operation: 'create',
      game: game.shared.id,
    });
    await configureCustomGame(s, host, { operation: 'open', side: 'white' });
    for (const side of SIDES) await seat(s, host, side, seats[side]);
    if (lineup.clock !== undefined)
      await configureCustomGame(s, host, {
        operation: 'clock',
        ...lineup.clock,
      });
    // Changing either side withdraws all readiness, so agree to the final lineup.
    if (lineup.ready !== false) await readyEveryPerson(s, seats, lineup);
    if (lineup.active !== false)
      await configureCustomGame(s, host, { operation: 'start' });
    await playCustomGameMoves(s, host, seats, lineup.moves ?? []);
  },
});
