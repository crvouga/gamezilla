/**
 * Hearts as people play it on the Custom Game screen: a custom game set up
 * through ordinary choices and started from a deal the room is told to deal
 * (its documented random draws), an earlier history played fast through the
 * room boundary, and then passes and cards made with the board's own
 * gestures, by pointer or by keyboard. A pass or card the board does not
 * take is sent as a modified device would, so a refusal is always the
 * product's, never the harness's.
 */

import { operateCustomGameControls } from '@libs/game-session-harness-ts/custom-game-controls';
import {
  type CustomGameSeat,
  establishCustomGame,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import {
  CUSTOM_GAME_BOARD,
  customGameBoardTakes,
  playOnCustomGameBoard,
} from '@libs/game-session-harness-ts/custom-game-moves';
import {
  type CustomGameShown,
  readCustomGameScreen,
} from '@libs/game-session-harness-ts/custom-game-screen';
import {
  chooseCustomGame,
  configureCustomGame,
} from '@libs/game-session-harness-ts/custom-game-ui';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import {
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { type HeartsLine, heartsLineDraws } from './hearts-lines';
import { type HeartsView, heartsView } from './hearts-view';

/** How long a person may take to catch up with a game played without them. */
const CATCH_UP_MS = 30_000;
/** How long the room may take to bring in a stand-in or let it decide. */
const STAND_IN_WAIT_MS = 300_000;
/** The steps virtual time advances in while waiting for the room. */
const WAIT_STEP_MS = 500;

/** A Hearts custom game: who sits where, who else is in the space, and how far it has gone. */
export type HeartsLineup = {
  /** Whose space it is; they create the game (default: Alice). */
  readonly host?: string;
  /** Who takes each seat (default: Alice, Bob, Carol and Dave from South). */
  readonly seats?: Readonly<Partial<Record<GameSide, CustomGameSeat>>>;
  /** People watching the custom game from the start. */
  readonly watchers?: readonly string[];
  /** People who join the space once the game is under way, without opening it. */
  readonly members?: readonly string[];
  /** Every person seated is ready (default). */
  readonly ready?: boolean;
  /** The game is started (default). */
  readonly active?: boolean;
  /** The deal the room deals and the history played from it (default: the game's known deal). */
  readonly line?: HeartsLine;
  /** After the history, this seat's person goes offline until a stand-in plays it. */
  readonly away?: GameSide;
  /** The away person is back online, the stand-in still playing, before `then`. */
  readonly back?: boolean;
  /** Played after, through the participants' choices; `*` lets the stand-in play its card. */
  readonly then?: readonly string[];
};

type Seats = Readonly<Record<GameSide, CustomGameSeat>>;

function seatsOf(lineup: HeartsLineup): Seats {
  return {
    white: lineup.seats?.white ?? 'alice',
    black: lineup.seats?.black ?? 'bob',
    red: lineup.seats?.red ?? 'carol',
    blue: lineup.seats?.blue ?? 'dave',
  };
}

function isPerson(seat: CustomGameSeat): boolean {
  return seat !== 'bot' && seat !== 'open';
}

async function gameOf(
  s: ProductHarness,
  actor: string
): Promise<CustomGameShown> {
  const game = (await readCustomGameScreen(s, actor))?.current;
  if (game == null) throw new Error(`${actor} sees no Hearts game`);
  return game;
}

async function movesSeen(s: ProductHarness, actor: string): Promise<number> {
  return (await readCustomGameScreen(s, actor))?.current?.moves.length ?? 0;
}

/** `person` signs in with Google, unless their device already has an account. */
async function signIn(s: ProductHarness, person: string): Promise<void> {
  if ((await signedInAccountOf(s, person)) === null)
    await Promise.resolve(signInWithGoogle.act(s, person));
  await Promise.resolve(backToTabs.act(s, person));
}

/** `person` joins `host`'s space from its link, without opening the custom game. */
async function joinSpace(
  s: ProductHarness,
  host: string,
  person: string
): Promise<void> {
  const link = await readSpaceLink(s, host);
  if (link === null) throw new Error(`${host} is not in a space`);
  await signIn(s, person);
  await Promise.resolve(openSpaceLink.act(s, person, link));
  await (await actorUi(s, person)).get('space-join').expect.visible();
  await Promise.resolve(joinFromPrompt.act(s, person));
}

/** Let the room's time pass until what `observer` sees satisfies `holds`. */
async function untilSeen(
  s: ProductHarness,
  observer: string,
  holds: (view: HeartsView) => boolean,
  description: string
): Promise<void> {
  let seen: HeartsView | null = null;
  for (let waited = 0; waited <= STAND_IN_WAIT_MS; waited += WAIT_STEP_MS) {
    seen = await heartsView(s, observer);
    if (holds(seen)) return;
    await s.session.advanceTime(WAIT_STEP_MS);
    await s.harness.drainServerFetch();
  }
  const last =
    seen === null
      ? 'nothing'
      : JSON.stringify({
          standIns: seen.standIns,
          committed: seen.committed,
          moves: seen.screen.current?.moves.length,
          status: seen.screen.current?.status,
          error: seen.screen.error,
        });
  throw new Error(
    `Hearts: ${description} never happened; ${observer} saw ${last}`
  );
}

/** `person` is back online and their screen connected again. */
async function backOnline(s: ProductHarness, person: string): Promise<void> {
  await Promise.resolve(restoreActorConnection.act(s, person));
  await pollUntil(
    s,
    async () =>
      (await readCustomGameScreen(s, person))?.connected === true ? true : null,
    { maxMs: CATCH_UP_MS, stepMs: 10, description: `${person} reconnects` }
  );
}

/** Play `then`: each card by the person to move, `*` by the stand-in on its own. */
async function playThen(
  s: ProductHarness,
  observer: string,
  seats: Seats,
  then: readonly string[]
): Promise<void> {
  for (const proposal of then) {
    const game = await gameOf(s, observer);
    const moves = game.moves.length;
    if (proposal === '*') {
      await untilSeen(
        s,
        observer,
        (view) => (view.screen.current?.moves.length ?? 0) > moves,
        'the stand-in card'
      );
      continue;
    }
    const mover = seats[game.turn];
    if (!isPerson(mover)) throw new Error(`${game.turn} has no person to play`);
    await configureCustomGame(s, String(mover), {
      operation: 'move',
      uci: proposal,
      ply: moves,
    });
  }
}

/** A Hearts custom game reached through ordinary choices and a documented deal. */
export const establishHearts = scenarioAction({
  name: 'establishHearts',
  act: async (s, lineup: HeartsLineup = {}) => {
    const host = lineup.host ?? 'alice';
    const seats = seatsOf(lineup);
    const line = lineup.line;
    await Promise.resolve(
      establishCustomGame.act(s, 'hearts', {
        host,
        first: seats.white,
        second: seats.black,
        third: seats.red,
        fourth: seats.blue,
        watchers: lineup.watchers ?? [],
        ...(lineup.ready === undefined ? {} : { ready: lineup.ready }),
        ...(lineup.active === undefined ? {} : { active: lineup.active }),
        ...(line === undefined
          ? {}
          : { draws: heartsLineDraws(line), history: line.history }),
      })
    );
    if (lineup.active === false) return;
    if (lineup.away !== undefined) {
      const side = lineup.away;
      const person = String(seats[side]);
      await Promise.resolve(partition.act(s, person));
      await untilSeen(
        s,
        host,
        (view) => view.standIns.includes(side),
        `a stand-in for ${side}`
      );
      if (lineup.back === true) await backOnline(s, person);
    }
    await playThen(s, host, seats, lineup.then ?? []);
    for (const member of lineup.members ?? []) await joinSpace(s, host, member);
  },
});

type DriverNode = ReturnType<Awaited<ReturnType<typeof actorUi>>['get']>;

/** Press a control as a person does: a tap, or the keyboard on it. */
async function press(node: DriverNode, keyboard: boolean): Promise<void> {
  if (keyboard) await node.key('enter');
  else await node.tap();
}

/**
 * Pass `cards`: choose each on the hand and confirm with the pass control
 * when the board takes them (three cards of the person's own hand while
 * they still choose), otherwise as a modified device would.
 */
export const passHeartsCards = scenarioAction<
  [actor: string, cards: readonly string[], keyboard?: boolean]
>({
  name: 'passHeartsCards',
  act: async (s, actor, cards, keyboard = false) => {
    const view = await heartsView(s, actor);
    const held = new Map(view.hand.map((card) => [card.card, card]));
    const takes =
      view.pass !== null &&
      cards.length === 3 &&
      cards.every((card) => held.get(card)?.allowed === true);
    if (!takes) {
      await chooseCustomGame(s, actor, {
        operation: 'commit',
        commitment: cards.join(''),
        ply: await movesSeen(s, actor),
      });
      return;
    }
    const ui = await actorUi(s, actor);
    for (const card of cards) {
      // A card chosen earlier (a choice still in progress) stays chosen.
      if (held.get(card)?.chosen === true) continue;
      await press(ui.get(`${CUSTOM_GAME_BOARD}-card-${card}`), keyboard);
      await s.session.waitForIdle();
    }
    await playOnCustomGameBoard(s, actor, async () => {
      await press(ui.get(`${CUSTOM_GAME_BOARD}-pass`), keyboard);
      return 'made';
    });
  },
});

/** Pass three cards of the person's choosing: the last three their hand shows. */
export const passAnyThreeHeartsCards = scenarioAction({
  name: 'passAnyThreeHeartsCards',
  act: async (s, actor: string) => {
    const hand = (await heartsView(s, actor)).hand.map((card) => card.card);
    await Promise.resolve(passHeartsCards.act(s, actor, hand.slice(-3)));
  },
});

/**
 * Play `card`: on the hand when the board takes it (the person's turn and a
 * card the rules allow), otherwise as a modified device would.
 */
export const playHeartsCard = scenarioAction<
  [actor: string, card: string, keyboard?: boolean]
>({
  name: 'playHeartsCard',
  act: async (s, actor, card, keyboard = false) => {
    const view = await heartsView(s, actor);
    const shown = view.hand.find((each) => each.card === card);
    if (
      shown?.allowed !== true ||
      view.pass !== null ||
      !(await customGameBoardTakes(s, actor, card))
    ) {
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: card,
        ply: await movesSeen(s, actor),
      });
      return;
    }
    const target = (await actorUi(s, actor)).get(
      `${CUSTOM_GAME_BOARD}-card-${card}`
    );
    await playOnCustomGameBoard(s, actor, async () => {
      await press(target, keyboard);
      return 'made';
    });
  },
});

/** Play the first card the person's hand allows now. */
export const playFirstAllowedHeartsCard = scenarioAction({
  name: 'playFirstAllowedHeartsCard',
  act: async (s, actor: string) => {
    const card = (await heartsView(s, actor)).hand.find((each) => each.allowed);
    if (card === undefined) throw new Error(`${actor} has no card to play`);
    await Promise.resolve(playHeartsCard.act(s, actor, card.card));
  },
});

/** The person to play plays the one card they still hold. */
export const playLastHeartsCard = scenarioAction({
  name: 'playLastHeartsCard',
  act: async (s, actor: string) => {
    const hand = (await heartsView(s, actor)).hand;
    if (hand.length !== 1)
      throw new Error(`${actor} holds ${hand.length} cards`);
    await Promise.resolve(playHeartsCard.act(s, actor, hand[0]!.card));
  },
});

/** Whoever has the turn plays the one card they still hold: the deal's last. */
export const playDealsLastCard = scenarioAction({
  name: 'playDealsLastCard',
  act: async (s, observer: string) => {
    const game = await gameOf(s, observer);
    const person = game[game.turn].person;
    for (const actor of s.actors.keys())
      if ((await readCustomGameScreen(s, actor))?.me === person) {
        await Promise.resolve(playLastHeartsCard.act(s, actor));
        return;
      }
    throw new Error('nobody plays the last card');
  },
});

/** Let the room's time pass until the stand-in playing `side` has made its secret choice. */
export const letStandInPass = scenarioAction({
  name: 'letStandInPass',
  act: (s, observer: string, side: GameSide) =>
    untilSeen(
      s,
      observer,
      // Chosen, or every pass already changed hands: no longer choosing.
      (view) => view.seats[side]?.facts.includes('Choosing') === false,
      `${side}'s stand-in passing`
    ),
});

/** Let the room's time pass until the stand-in playing `side` has played its card. */
export const letStandInPlay = scenarioAction({
  name: 'letStandInPlay',
  act: async (s, observer: string, side: GameSide) => {
    const game = await gameOf(s, observer);
    if (game.turn !== side) throw new Error(`it is not ${side}'s turn`);
    const moves = game.moves.length;
    await untilSeen(
      s,
      observer,
      (view) => (view.screen.current?.moves.length ?? 0) > moves,
      `${side}'s stand-in card`
    );
  },
});

/** `person`'s phone goes offline and stays so for `ms` of the room's time. */
export const stayOffline = scenarioAction({
  name: 'stayOffline',
  act: async (s, person: string, ms: number) => {
    await Promise.resolve(partition.act(s, person));
    await s.session.advanceTime(ms);
    await s.harness.drainServerFetch();
  },
});

/** `person` is back online, their screen connected again. */
export const comeBackOnline = scenarioAction({
  name: 'comeBackOnline',
  act: backOnline,
});

/** Take back one's side from the stand-in playing it, as the screen offers. */
export const takeBackHeartsSide = scenarioAction({
  name: 'takeBackHeartsSide',
  act: (s, actor: string) =>
    operateCustomGameControls(s, actor, { operation: 'reclaim' }),
});

/**
 * Against bots: pass and play every card of the deal under way, the
 * person following the board and every bot deciding on its own, until the
 * person holds their last card and it is their turn.
 */
export const playHeartsUntilLastCard = scenarioAction({
  name: 'playHeartsUntilLastCard',
  act: async (s, actor: string) => {
    for (let turn = 0; turn < 2000; turn += 1) {
      const view = await heartsView(s, actor);
      if (view.pass !== null) {
        await Promise.resolve(passAnyThreeHeartsCards.act(s, actor));
        continue;
      }
      if (view.hand.some((card) => card.allowed)) {
        if (view.hand.length === 1) return;
        await Promise.resolve(playFirstAllowedHeartsCard.act(s, actor));
        continue;
      }
      await s.session.advanceTime(WAIT_STEP_MS);
      await s.harness.drainServerFetch();
    }
    throw new Error('the deal never reached the last card');
  },
});

/** `actor` listens to the app as it reads the Hearts table aloud. */
export const listenToHearts = scenarioAction({
  name: 'listenToHearts',
  act: async (s, actor: string) => {
    await actorPage(s, actor);
  },
});

export const HEARTS_ACTIONS = [
  establishHearts,
  passHeartsCards,
  passAnyThreeHeartsCards,
  playHeartsCard,
  playFirstAllowedHeartsCard,
  playLastHeartsCard,
  playDealsLastCard,
  letStandInPass,
  letStandInPlay,
  stayOffline,
  comeBackOnline,
  takeBackHeartsSide,
  playHeartsUntilLastCard,
  listenToHearts,
];
