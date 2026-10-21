/**
 * The game `specs/games/private-setup.qnt` follows, of the trace's game (one
 * with private setups): Alice's custom game against Bob or a bot, or her
 * matched game against Bob, with Carol in Alice's space watching, and Dave,
 * who never loses his connection, there too so the game itself is read where
 * anyone connected sees it.
 *
 * The model's two complete private setups are the game's own: a person's
 * "complete layout" is the known setup of the side they first play
 * (`fixtures.setups`), and their "other complete layout" another complete
 * setup the game draws, different from every other one in the trace, so
 * whose setup reaches whom can always be told. The other ones are chosen so
 * that no move of the known victory before its last ends the game, whoever
 * hides which, as the model's game never ends by its moves.
 */

import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness/multiplayer-board';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import {
  awaitGameMatchChoosingSetups,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import {
  givenGameSpace,
  openFindingAnOpponent,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import { operateCustomGame } from '@libs/game-session-harness/custom-game-controls';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness/custom-game-moves';
import {
  anotherCompleteSetup,
  arrangeCustomGamePrivateSetup,
  changeCustomGamePrivateSetup,
} from '@libs/game-session-harness/custom-game-private-setup';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-probe';
import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  changeMatchedPrivateSetup,
  chooseMatchedPrivateSetup,
} from '@libs/game-session-harness/matched-game-private-setup';
import { matchedSetupBoardShown } from '@libs/game-session-harness/matched-setup-board';
import { playedRules } from '@libs/game-session-harness/played-rules';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import { accountIdOf } from '@libs/harness/identity';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { backToTabs } from '@libs/harness/shell-actions';
import type { GameSetups } from '@pkgs/turn-game-shared/game-rules';
import { productClockChoice } from './matched-game-clock';
import { modelGameOf, VICTORY_MOVES, victoryMoveAt } from './model-game';

/** The model's people: Alice and Bob may play; Carol watches. */
export const SETUP_PEOPLE = ['alice', 'bob', 'carol'] as const;
/** In the space on neither side, always connected: where the game is read. */
export const SETUP_OBSERVER = 'dave';
/**
 * The clock choice of the matched game: the model has only the 2 minutes to
 * choose and the 30 seconds for each first move, so the clocks that run
 * after both first moves are long enough that no trace runs one out.
 */
const CLOCK_CHOICE = '30+0';

export type SetupKind = 'custom' | 'matched';
export type Layout = 'complete layout' | 'other complete layout';

const KIND = 'private-setup:kind';
const IDS = 'private-setup:ids';
const LAYOUTS = 'private-setup:layouts';
/** The layout each person last arranged on a matched setup board that took it. */
const ARRANGED = 'private-setup:arranged';
const COMMANDS = 'private-setup:commands';
/** How long anyone waits for a bot's answer: the runner's patience. */
const BOT_ANSWER_MS = 15_000;

/** The trace's beginning: a custom game or a matched game. */
export function setupKind(w: QuintHarnessWorld): SetupKind {
  const kind = w.memo.get(KIND);
  if (kind !== 'custom' && kind !== 'matched')
    throw new Error('The private-setup trace has no game yet');
  return kind;
}

/** Each named person's identity in the trace's game (member or account id). */
export function setupIds(w: QuintHarnessWorld): Map<string, string> {
  const ids = w.memo.get(IDS);
  if (ids instanceof Map) return ids as Map<string, string>;
  const created = new Map<string, string>();
  w.memo.set(IDS, created);
  return created;
}

/** The person an identity stands for, as the model names them. */
export function setupName(w: QuintHarnessWorld, id: string): string {
  for (const [name, known] of setupIds(w)) if (known === id) return name;
  return `someone else (${id})`;
}

/** Whether `rules` played with `setups` lets the first `plies` moves of `line` all happen without ending the game. */
function lineKeepsGoing(
  game: HarnessGame,
  setups: GameSetups,
  line: readonly string[],
  plies: number
): boolean {
  const rules = playedRules(game.shared.turnGame.rules, setups);
  let position = rules.initial();
  let history = '';
  const played: string[] = [];
  for (const proposal of line.slice(0, plies)) {
    const next = rules.play(position, proposal, history, played);
    if (next === null || next.winner !== null) return false;
    played.push(proposal);
    position = next.position;
    history = next.history;
  }
  return true;
}

/**
 * Alice's and Bob's two complete setups: each one's known setup and
 * another, all four different, so that the victory's moves before its last
 * never end the game whichever each hides and whichever side each plays.
 */
export function setupLayouts(
  w: QuintHarnessWorld
): ReadonlyMap<string, Readonly<Record<Layout, string>>> {
  const remembered = w.memo.get(LAYOUTS);
  if (remembered instanceof Map)
    return remembered as ReadonlyMap<string, Record<Layout, string>>;
  const game = modelGameOf(w);
  const known = game.fixtures.setups;
  if (known === undefined)
    throw new Error(`${game.label} names no known private setups`);
  const victory = game.fixtures.firstSideVictory;
  const keepsGoing = (alice: readonly string[], bob: readonly string[]) =>
    alice.every((a) =>
      bob.every(
        (b) =>
          lineKeepsGoing(
            game,
            { white: a, black: b },
            victory,
            VICTORY_MOVES - 1
          ) &&
          lineKeepsGoing(
            game,
            { white: b, black: a },
            victory,
            VICTORY_MOVES - 1
          )
      )
    );
  const taken: string[] = [known.white, known.black];
  const draw = (fits: (setup: string) => boolean): string => {
    for (let tries = 0; tries < 64; tries += 1) {
      const setup = anotherCompleteSetup(game, taken);
      taken.push(setup);
      if (fits(setup)) return setup;
    }
    throw new Error(
      `${game.label} draws no other complete setup its known victory keeps going against`
    );
  };
  const aliceOther = draw((a) => keepsGoing([known.white, a], [known.black]));
  const bobOther = draw((b) =>
    keepsGoing([known.white, aliceOther], [known.black, b])
  );
  const layouts = new Map<string, Record<Layout, string>>([
    [
      'alice',
      { 'complete layout': known.white, 'other complete layout': aliceOther },
    ],
    [
      'bob',
      { 'complete layout': known.black, 'other complete layout': bobOther },
    ],
  ]);
  w.memo.set(LAYOUTS, layouts);
  return layouts;
}

/** The setup the model's `layout` is for `actor`. */
function setupFor(w: QuintHarnessWorld, actor: string, layout: string): string {
  const setup = setupLayouts(w).get(actor)?.[layout as Layout];
  if (setup === undefined)
    throw new Error(`The model has no "${layout}" for ${actor}`);
  return setup;
}

/** The model's name for a setup a person holds: '' or none is "incomplete". */
export function layoutOf(
  w: QuintHarnessWorld,
  actor: string,
  setup: string | null | undefined
): string {
  if (setup === null || setup === undefined || setup === '')
    return 'incomplete';
  const layouts = setupLayouts(w).get(actor);
  for (const [layout, known] of Object.entries(layouts ?? {}))
    if (known === setup) return layout;
  return `an unknown setup (${setup})`;
}

/** The layout `actor` last arranged on a matched setup board that took it. */
export function arrangedLayout(
  w: QuintHarnessWorld,
  actor: string
): string | undefined {
  return (w.memo.get(ARRANGED) as Map<string, string> | undefined)?.get(actor);
}

async function prepareCustom(w: QuintHarnessWorld, second: 'bob' | 'bot') {
  const watchers = [
    ...(second === 'bot' ? ['bob'] : []),
    'carol',
    SETUP_OBSERVER,
  ];
  await w.s.apply(establishCustomGame, modelGameOf(w).shared.id, {
    host: 'alice',
    first: 'alice',
    second,
    watchers,
    ready: false,
    active: false,
  });
  for (const person of ['alice', 'bob', 'carol', SETUP_OBSERVER]) {
    const id = (await w.s.read(readCustomGameProbe, person))?.myId;
    if (!id) throw new Error(`${person} sees no custom games`);
    setupIds(w).set(person, id);
  }
  // Alice and Bob arrange their own private setups from nothing.
  for (const person of ['alice', 'bob'])
    await w.s.apply(arrangeCustomGamePrivateSetup, person, null);
}

async function prepareMatched(w: QuintHarnessWorld) {
  const gameId = modelGameOf(w).shared.id;
  for (const person of ['alice', 'bob']) {
    await w.s.apply(signInWithGoogle, person);
    await w.s.apply(backToTabs, person);
    await w.s.apply(givenGameSpace, person);
    await w.s.apply(openFindingAnOpponent, person, gameId);
  }
  for (const watcher of ['carol', SETUP_OBSERVER])
    await w.s.apply(joinMultiplayerSpace, watcher, 'alice');
  for (const person of ['alice', 'bob']) {
    const id = await w.s.read(accountIdOf, person);
    if (id === null) throw new Error(`${person} has no account`);
    setupIds(w).set(person, id);
  }
  // Pairing starts the 2 minutes to choose, so it comes last.
  const clock = productClockChoice(w, CLOCK_CHOICE);
  await w.s.apply(givenOpponentSearch, 'alice', clock);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, 'bob', clock);
  await w.s.apply(awaitGameMatchChoosingSetups, 'alice', 'bob', true);
}

/** The model's beginning, of the trace's game. */
export async function prepareSetupModel(
  w: QuintHarnessWorld,
  beginning: string
): Promise<void> {
  setupLayouts(w);
  if (beginning === 'custom game against Bob') {
    w.memo.set(KIND, 'custom');
    await prepareCustom(w, 'bob');
  } else if (beginning === 'custom game against a bot') {
    w.memo.set(KIND, 'custom');
    await prepareCustom(w, 'bot');
  } else if (beginning === 'matched game') {
    w.memo.set(KIND, 'matched');
    await prepareMatched(w);
  } else throw new Error(`The model has no beginning "${beginning}"`);
}

/** A choice in the custom game, made with the screen's controls where it offers them. */
export async function customChoice(
  w: QuintHarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  await w.s.apply(operateCustomGame, actor, input);
}

/**
 * A bot answers each move at once: Dave, in the space, waits the moment its
 * wake takes (a second) until the custom game is no longer the bot's to
 * move. One that never answers is left for the observation to report.
 */
export async function awaitBotAnswer(w: QuintHarnessWorld): Promise<void> {
  if (setupKind(w) !== 'custom') return;
  try {
    await w.s.until((s) => readCustomGameProbe(s, SETUP_OBSERVER), {
      pred: (probe) => {
        const game = probe?.current;
        if (game === null || game === undefined || game.status !== 'active')
          return true;
        return (game.turn === 'white' ? game.white : game.black).kind !== 'bot';
      },
      maxMs: BOT_ANSWER_MS,
    });
  } catch {
    // Still the bot's move: the model's state says it should have answered.
  }
}

/** `actor`'s matched game, as their own device holds it; `null` for a watcher. */
async function ownMatchedGame(w: QuintHarnessWorld, actor: string) {
  return (await w.s.read(multiplayerView, actor)).game;
}

/** A command on `actor`'s own matched game, as their screen sends it; a watcher has none to send. */
export async function matchedCommand(
  w: QuintHarnessWorld,
  actor: string,
  name: string,
  args: (game: {
    readonly revision: number;
  }) => Record<string, unknown> = () => ({})
): Promise<void> {
  const game = await ownMatchedGame(w, actor);
  if (game === null) return;
  const sent = Number(w.memo.get(COMMANDS) ?? 0) + 1;
  w.memo.set(COMMANDS, sent);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name,
    args: {
      gameId: game.id,
      requestId: `private-setup-${String(sent)}`,
      ...args(game),
    },
  });
}

/** `actor` changes their private setup to `layout`, on their setup board while it takes one. */
export async function changeSetup(
  w: QuintHarnessWorld,
  actor: string,
  layout: string
): Promise<void> {
  const setup = SETUP_PEOPLE.includes(actor as 'alice')
    ? setupLayouts(w).get(actor)?.[layout as Layout]
    : undefined;
  if (setupKind(w) === 'custom') {
    // Someone with no setups of their own tries the other's, which the game refuses.
    await w.s.apply(
      changeCustomGamePrivateSetup,
      actor,
      setup ?? setupFor(w, 'alice', layout)
    );
    return;
  }
  // A watcher has no matched game of their own and no setup board to change.
  if ((await ownMatchedGame(w, actor)) === null || setup === undefined) return;
  const onBoard = await w.s.read(matchedSetupBoardShown, actor);
  await w.s.apply(changeMatchedPrivateSetup, actor, setup);
  if (onBoard) {
    const arranged =
      (w.memo.get(ARRANGED) as Map<string, string> | undefined) ??
      new Map<string, string>();
    arranged.set(actor, layout);
    w.memo.set(ARRANGED, arranged);
  }
}

/** `actor` chooses the private setup on their matched setup board. */
export async function chooseSetup(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  if ((await ownMatchedGame(w, actor)) === null) return;
  await w.s.apply(chooseMatchedPrivateSetup, actor);
}

/** `actor` makes the known victory's next move, on the board in front of them. */
export async function playSetupMove(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  if (setupKind(w) === 'matched') {
    await matchedCommand(w, actor, 'playMultiplayerMove', (game) => ({
      revision: game.revision,
      uci: victoryMoveAt(w, game.revision),
    }));
    return;
  }
  const game = (await w.s.read(readCustomGameProbe, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no custom game`);
  await w.s.apply(
    makeCustomGameMove,
    actor,
    modelGameOf(w).shared.id,
    victoryMoveAt(w, game.moves.length)
  );
}

/** Seconds pass for everyone, devices and server alike. */
export async function setupSecondsPass(
  w: QuintHarnessWorld,
  seconds: number
): Promise<void> {
  await w.s.apply(passMultiplayerTime, seconds * 1000);
}

/** `actor`'s device loses its connection, or gets it back. */
export async function setupConnection(
  w: QuintHarnessWorld,
  actor: string,
  online: boolean
): Promise<void> {
  if (setupKind(w) === 'matched') {
    await w.s.apply(setMultiplayerConnection, actor, online);
    return;
  }
  await w.s.apply(online ? restoreActorConnection : partition, actor);
}
