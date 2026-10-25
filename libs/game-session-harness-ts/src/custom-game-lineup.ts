import { hostedSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import {
  type CustomGameSide,
  CustomGamesAttr,
} from '@libs/game-session-shared-ts/custom-game-state';
import {
  partition,
  refreshActorConnection,
  restoreNetwork,
} from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
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
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { playCustomGameHistory } from './custom-game-history';
import { readCustomGameProbe } from './custom-game-probe';
import { configureCustomGame, waitCustomGameSettled } from './custom-game-ui';
import { showCustomGames } from './game-navigation';
import { harnessGameOf } from './harness-game-of';
import { splitCommittedProposal } from './played-rules';
import { queueRoomDraws } from './room-draws';

/** Who takes each side: a person by name, a bot, or nobody yet. */
export type CustomGameSeat = string | 'bot' | 'local' | 'open';

/** A custom game of any game, reached through ordinary choices only. */
export type CustomGameLineup = {
  readonly host?: string;
  readonly first?: CustomGameSeat;
  readonly second?: CustomGameSeat;
  readonly third?: CustomGameSeat;
  readonly fourth?: CustomGameSeat;
  readonly watchers?: readonly string[];
  /** The clock choice the creator makes before anyone agrees (default: untimed). */
  readonly clock?: { readonly minutes: number; readonly increment: number };
  /** Every person in it agrees to start (default). */
  readonly ready?: boolean;
  /** It is started (default). */
  readonly active?: boolean;
  /** People may establish the game as guests, without creating accounts. */
  readonly guests?: boolean;
  /** The game's own configuration, chosen before readiness. */
  readonly configuration?: string;
  /** Moves played from the start, alternating sides. */
  readonly moves?: readonly string[];
  /**
   * Proposals played first, as an earlier history, straight through the
   * real server's room boundary under each seat's device: a long game (every
   * card of a Hearts game) reaches its end in seconds, then `moves` follow
   * through the participants' choices.
   */
  readonly history?: readonly string[];
  /** A side's private setup other than the game's known one, for a game with private setups. */
  readonly setups?: Partial<Record<CustomGameSide, string>>;
  /**
   * For a game with dealt hands, the numbers the room's random draws return
   * as it starts the game, in place of the game's known deal: a deal a
   * scenario names, dealt by the room's own dealing as a documented choice.
   */
  readonly draws?: readonly number[];
};

function isPerson(seat: CustomGameSeat): boolean {
  return seat !== 'bot' && seat !== 'local' && seat !== 'open';
}

async function seat(
  s: ProductHarness,
  host: string,
  side: CustomGameSide,
  person: CustomGameSeat
): Promise<void> {
  if (person === 'open') return;
  if (person === 'local') {
    await configureCustomGame(s, host, { operation: 'local', side });
    return;
  }
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
  seats: Readonly<
    Record<'white' | 'black', CustomGameSeat> &
      Partial<Record<'red' | 'blue', CustomGameSeat>>
  >,
  moves: readonly string[]
): Promise<void> {
  for (const move of moves) {
    const game = (await readCustomGameProbe(s, observer))?.current;
    if (game === null || game === undefined) throw new Error('No game');
    const commitments = splitCommittedProposal(move);
    if (commitments !== null) {
      await commitCustomGameSides(s, seats, game, commitments);
      continue;
    }
    const mover = seats[game.turn];
    if (mover === undefined || !isPerson(mover))
      throw new Error(`The ${game.turn} side has no person to play ${move}`);
    await configureCustomGame(s, mover, {
      operation: 'move',
      uci: move,
      ply: game.moves.length,
    });
  }
}

/** Every committing side's person commits its part of a combined proposal, in seat order. */
async function commitCustomGameSides(
  s: ProductHarness,
  seats: Readonly<Partial<Record<GameSide, CustomGameSeat>>>,
  game: {
    readonly awaiting: readonly GameSide[];
    readonly moves: readonly unknown[];
  },
  commitments: readonly string[]
): Promise<void> {
  if (game.awaiting.length !== commitments.length)
    throw new Error(
      `${String(game.awaiting.length)} sides commit, not ${String(commitments.length)}`
    );
  for (const [index, side] of [...game.awaiting].entries()) {
    const committer = seats[side];
    if (committer === undefined || !isPerson(committer))
      throw new Error(`The ${side} side has no person to commit`);
    await configureCustomGame(s, committer, {
      operation: 'commit',
      commitment: commitments[index]!,
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

async function preparePeople(
  s: ProductHarness,
  people: readonly string[],
  guests: boolean
): Promise<void> {
  for (const person of people) {
    if (guests) await actorUi(s, person);
    else await signIn(s, person);
  }
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
  const current = (await readCustomGameProbe(s, lineup.host ?? 'alice'))
    ?.current;
  if (current === null || current === undefined) throw new Error('No game');
  for (const side of current.sides) {
    if (!isPerson(seats[side])) continue;
    const setup = lineup.setups?.[side];
    await configureCustomGame(s, seats[side], {
      operation: 'ready',
      ...(setup === undefined ? {} : { setup }),
    });
  }
}

/**
 * The creator starts the game: from the game's known deal, or, when the
 * lineup names its own draws, from those, pressing the start control so
 * nothing replaces them with the known deal.
 */
async function startCustomGame(
  s: ProductHarness,
  host: string,
  draws: readonly number[] | undefined
): Promise<void> {
  if (draws === undefined) {
    await configureCustomGame(s, host, { operation: 'start' });
    return;
  }
  const before = await readCustomGameProbe(s, host);
  if (before === null) throw new Error(`${host} sees no custom game`);
  queueRoomDraws(s, draws);
  await (await actorUi(s, host)).get('custom-game-start').tap();
  const refused = await waitCustomGameSettled(s, host, before.settled);
  if (refused !== '') throw new Error(`could not establish start: ${refused}`);
}

/**
 * An earlier history nobody watches: the people's devices are cut off while
 * it is played and catch up with the game it reached after.
 */
async function playHistory(
  s: ProductHarness,
  history: {
    readonly label: string;
    readonly host: string;
    readonly people: readonly string[];
    readonly seats: Readonly<Partial<Record<GameSide, CustomGameSeat>>>;
    readonly moves: readonly string[];
  }
): Promise<void> {
  const { seats, people } = history;
  const spaceId = await hostedSpaceId(s, history.host);
  if (spaceId === null)
    throw new Error(`${history.label}: no space for its history`);
  for (const person of people) {
    await Promise.resolve(partition.act(s, person));
    await Promise.resolve(refreshActorConnection.act(s, person));
  }
  await Promise.resolve(
    playCustomGameHistory.act(s, {
      spaceId,
      white: String(seats.white),
      black: String(seats.black),
      ...(seats.red === undefined ? {} : { red: String(seats.red) }),
      ...(seats.blue === undefined ? {} : { blue: String(seats.blue) }),
      moves: history.moves,
    })
  );
  await Promise.resolve(restoreNetwork.act(s));
  const reached = CustomGamesAttr.from(
    s.harness.roomNode.inspect(`space:${spaceId}`)?.committedState ?? {}
  ).current?.moves.length;
  for (const person of people)
    await pollUntil(
      s,
      async () => {
        const probe = await readCustomGameProbe(s, person);
        return probe?.connected === true &&
          probe.current?.moves.length === reached
          ? true
          : null;
      },
      { maxMs: 30_000, stepMs: 10, description: `${person} catches up` }
    );
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
      red: lineup.third ?? 'carol',
      blue: lineup.fourth ?? 'dave',
    };
    const sides = gameSides(game.shared.registration.rules);
    const people = [
      ...new Set([
        host,
        ...sides.map((side) => seats[side]),
        ...(lineup.watchers ?? []),
      ]),
    ].filter(isPerson);
    await preparePeople(s, people, lineup.guests === true);
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
    for (const side of sides) await seat(s, host, side, seats[side]);
    if (lineup.clock !== undefined)
      await configureCustomGame(s, host, {
        operation: 'clock',
        ...lineup.clock,
      });
    if (lineup.configuration !== undefined)
      await configureCustomGame(s, host, {
        operation: 'rules',
        choice: lineup.configuration,
      });
    // Changing either side withdraws all readiness, so agree to the final lineup.
    if (lineup.ready !== false) await readyEveryPerson(s, seats, lineup);
    if (lineup.active !== false) await startCustomGame(s, host, lineup.draws);
    if (lineup.history !== undefined && lineup.history.length > 0)
      await playHistory(s, {
        label: game.label,
        host,
        people,
        seats: Object.fromEntries(sides.map((side) => [side, seats[side]])),
        moves: lineup.history,
      });
    await playCustomGameMoves(s, host, seats, lineup.moves ?? []);
  },
});
