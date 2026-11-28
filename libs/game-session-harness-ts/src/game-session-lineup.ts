import { hostedSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import {
  type GameSessionSide,
  GameSessionsAttr,
} from '@libs/game-session-shared-ts/game-session-state';
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
  reopenSpaceLink,
} from '@libs/spaces-harness-ts/space-actions';
import { joinSpaceFromLink } from '@libs/spaces-harness-ts/space-link';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { showGameSessions } from './game-navigation';
import { playGameSessionHistory } from './game-session-history';
import { showGameSessionHome } from './game-session-places';
import { readGameSessionProbe } from './game-session-probe';
import {
  configureGameSession,
  waitGameSessionSettled,
} from './game-session-ui';
import { harnessGameOf } from './harness-game-of';
import { splitCommittedProposal } from './played-rules';
import { queueRoomDraws } from './room-draws';

/** Who takes each side: a person by name, a bot, or nobody yet. */
export type GameSessionSeat = string | 'bot' | 'local' | 'open';

/** A game session of any game, reached through ordinary choices only. */
export type GameSessionLineup = {
  readonly host?: string;
  readonly first?: GameSessionSeat;
  readonly second?: GameSessionSeat;
  readonly third?: GameSessionSeat;
  readonly fourth?: GameSessionSeat;
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
  readonly setups?: Partial<Record<GameSessionSide, string>>;
  /**
   * For a game with dealt hands, the numbers the room's random draws return
   * as it starts the game, in place of the game's known deal: a deal a
   * scenario names. An empty list leaves every draw to the room.
   */
  readonly draws?: readonly number[];
};

function isPerson(seat: GameSessionSeat): boolean {
  return seat !== 'bot' && seat !== 'local' && seat !== 'open';
}

async function seat(
  s: ProductHarness,
  host: string,
  side: GameSessionSide,
  person: GameSessionSeat
): Promise<void> {
  if (person === 'open') return;
  if (person === 'local') {
    await configureGameSession(s, host, { operation: 'local', side });
    return;
  }
  if (person === 'bot') {
    await configureGameSession(s, host, { operation: 'bot', side });
    return;
  }
  if (person === host) {
    await configureGameSession(s, host, { operation: 'take', side });
    return;
  }
  const id = (await readGameSessionProbe(s, person))?.myId;
  if (!id) throw new Error(`No identity for ${person}`);
  await configureGameSession(s, host, {
    operation: 'invite',
    side,
    person: id,
  });
  await configureGameSession(s, person, { operation: 'accept', side });
}

/** Play `moves` by whoever has each turn, through the participants' choices. */
export async function playGameSessionMoves(
  s: ProductHarness,
  observer: string,
  seats: Readonly<
    Record<'white' | 'black', GameSessionSeat> &
      Partial<Record<'red' | 'blue', GameSessionSeat>>
  >,
  moves: readonly string[]
): Promise<void> {
  for (const move of moves) {
    const game = (await readGameSessionProbe(s, observer))?.current;
    if (game === null || game === undefined) throw new Error('No game');
    const commitments = splitCommittedProposal(move);
    if (commitments !== null) {
      await commitGameSessionSides(s, seats, game, commitments);
      continue;
    }
    const mover = seats[game.turn];
    if (mover === undefined || !isPerson(mover))
      throw new Error(`The ${game.turn} side has no person to play ${move}`);
    await configureGameSession(s, mover, {
      operation: 'move',
      uci: move,
      ply: game.moves.length,
    });
  }
}

/** Every committing side's person commits its part of a combined proposal, in seat order. */
async function commitGameSessionSides(
  s: ProductHarness,
  seats: Readonly<Partial<Record<GameSide, GameSessionSeat>>>,
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
    await configureGameSession(s, committer, {
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

/** `person` comes into `link`'s space at the game's game sessions. */
async function enterGameSessions(
  s: ProductHarness,
  gameId: string,
  person: string,
  link: string
): Promise<void> {
  // regression: connect-four-fixture-before-space-join
  await joinSpaceFromLink(s, person, link, 'enter');
  await showGameSessions(s, person, gameId);
}

/** Who joins whose space, for the game's game sessions, signed in or not. */
type Joining = {
  readonly gameId: string;
  readonly host: string;
  readonly person: string;
  readonly guest: boolean;
};

async function join(s: ProductHarness, joining: Joining): Promise<void> {
  const { gameId, host, person } = joining;
  if (s.actors.has(person) && (await readGameSessionProbe(s, person)) !== null)
    return;
  const link = await readSpaceLink(s, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  if (!joining.guest) await signIn(s, person);
  await enterGameSessions(s, gameId, person, link);
}

/**
 * `person` joins `host`'s space from its link and opens the game's custom
 * games, as anyone the host shares the link with does; someone already
 * shown them stays as they are.
 */
export const joinGameSessions = scenarioAction({
  name: 'joinGameSessions',
  act: (s, gameId: string, host: string, person: string) =>
    join(s, { gameId, host, person, guest: false }),
});

/** {@link joinGameSessions} as a guest, who has not signed in. */
export const joinGameSessionsAsGuest = scenarioAction({
  name: 'joinGameSessionsAsGuest',
  act: (s, gameId: string, host: string, person: string) =>
    join(s, { gameId, host, person, guest: true }),
});

/**
 * `person`, in the space at `link` but away from its game sessions (on
 * another tab, back from signing in or reopening the app), returns to them;
 * someone already shown them stays as they are.
 */
export const returnToGameSessions = scenarioAction({
  name: 'returnToGameSessions',
  act: async (s, gameId: string, person: string, link: string) => {
    if ((await readGameSessionProbe(s, person)) !== null) return;
    await Promise.resolve(reopenSpaceLink.act(s, person, link));
    await showGameSessions(s, person, gameId);
  },
});

/** Every person seated agrees, each with the setup the lineup names, if any. */
async function readyEveryPerson(
  s: ProductHarness,
  seats: Record<GameSessionSide, GameSessionSeat>,
  lineup: GameSessionLineup
): Promise<void> {
  const current = (await readGameSessionProbe(s, lineup.host ?? 'alice'))
    ?.current;
  if (current === null || current === undefined) throw new Error('No game');
  for (const side of current.sides) {
    if (!isPerson(seats[side])) continue;
    const setup = lineup.setups?.[side];
    await configureGameSession(s, seats[side], {
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
async function startGameSession(
  s: ProductHarness,
  host: string,
  draws: readonly number[] | undefined
): Promise<void> {
  if (draws === undefined) {
    await configureGameSession(s, host, { operation: 'start' });
    return;
  }
  const before = await readGameSessionProbe(s, host);
  if (before === null) throw new Error(`${host} sees no game session`);
  queueRoomDraws(s, draws);
  await showGameSessionHome(s, host);
  await (await actorUi(s, host)).get('game-session-start').tap();
  const refused = await waitGameSessionSettled(s, host, before.settled);
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
    readonly seats: Readonly<Partial<Record<GameSide, GameSessionSeat>>>;
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
    playGameSessionHistory.act(s, {
      spaceId,
      white: String(seats.white),
      black: String(seats.black),
      ...(seats.red === undefined ? {} : { red: String(seats.red) }),
      ...(seats.blue === undefined ? {} : { blue: String(seats.blue) }),
      moves: history.moves,
    })
  );
  await Promise.resolve(restoreNetwork.act(s));
  const reached = GameSessionsAttr.from(
    s.harness.roomNode.inspect(`space:${spaceId}`)?.committedState ?? {}
  ).current?.moves.length;
  for (const person of people)
    await pollUntil(
      s,
      async () => {
        const probe = await readGameSessionProbe(s, person);
        return probe?.connected === true &&
          probe.current?.moves.length === reached
          ? true
          : null;
      },
      { maxMs: 30_000, stepMs: 10, description: `${person} catches up` }
    );
}

/** Preconditions use ordinary space and game choices, never inject a board or a winner. */
export const establishGameSession = scenarioAction({
  name: 'establishGameSession',
  act: async (s, gameId: string, lineup: GameSessionLineup = {}) => {
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
    const mode = sides.some((side) => seats[side] === 'bot')
      ? 'vs-bot'
      : 'vs-human';
    await showGameSessions(s, host, game.shared.id, mode);
    for (const person of people.filter((p) => p !== host))
      await enterGameSessions(s, game.shared.id, person, link);
    await configureGameSession(s, host, {
      operation: 'create',
      mode,
      game: game.shared.id,
    });
    if (mode === 'vs-human') {
      await configureGameSession(s, host, { operation: 'open', side: 'white' });
      for (const side of sides) await seat(s, host, side, seats[side]);
    } else if (seats.white === 'bot') {
      await configureGameSession(s, host, { operation: 'swap' });
      if (seats.black === 'bot') await seat(s, host, 'black', 'bot');
    }
    if (lineup.clock !== undefined)
      await configureGameSession(s, host, {
        operation: 'clock',
        ...lineup.clock,
      });
    if (lineup.configuration !== undefined)
      await configureGameSession(s, host, {
        operation: 'rules',
        choice: lineup.configuration,
      });
    // Changing either side withdraws all readiness, so agree to the final lineup.
    if (lineup.ready !== false) await readyEveryPerson(s, seats, lineup);
    if (lineup.active !== false) await startGameSession(s, host, lineup.draws);
    if (lineup.history !== undefined && lineup.history.length > 0)
      await playHistory(s, {
        label: game.label,
        host,
        people,
        seats: Object.fromEntries(sides.map((side) => [side, seats[side]])),
        moves: lineup.history,
      });
    await playGameSessionMoves(s, host, seats, lineup.moves ?? []);
  },
});
