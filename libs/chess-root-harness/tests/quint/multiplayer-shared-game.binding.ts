/**
 * `specs/chess/multiplayer-shared-game.qnt` against one matched game both
 * spaces show. Guests watch. An offline device keeps the last board it
 * showed. Quiet minutes add up: one is not idle, and two is.
 */

import {
  copyGameRecord,
  gameRecordOffered,
} from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import {
  joinMultiplayerSpace,
  multiplayerWatcherBoard,
} from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import {
  changeSpaceMatch,
  prepareMultiplayerSpaceModel,
} from '@libs/chess-root-harness/multiplayer-space-model';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { profileIdOf } from '@libs/profile-harness/profile-ui-reads';
import { stayIdle } from '@libs/spaces-harness/space-idle-actions';
import { personIdleShown } from '@libs/spaces-harness/space-idle-reads';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const ACTOR: Record<string, string> = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
  'carol-phone': 'carol',
  'dave-phone': 'dave',
};

/** Who shares a space with the person, so they can see that person idle. */
const IDLE_FROM: Record<string, string> = {
  alice: 'carol',
  bob: 'dave',
  carol: 'alice',
  dave: 'bob',
};

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

function actorOf(device: string): string {
  const actor = ACTOR[device];
  if (actor === undefined) throw new Error(`unknown device ${device}`);
  return actor;
}

function winnerOf(outcome: string | null): string {
  if (outcome === 'white') return 'alice';
  if (outcome === 'black') return 'bob';
  return 'nobody';
}

async function boards(s: ProductHarness): Promise<{
  readonly shownMoves: Map<string, number>;
  readonly shownWinner: Map<string, string>;
  readonly canMove: Map<string, boolean>;
}> {
  const shownMoves = new Map<string, number>();
  const shownWinner = new Map<string, string>();
  const canMove = new Map<string, boolean>();
  for (const [device, actor] of Object.entries(ACTOR)) {
    const board = await multiplayerWatcherBoard(s, actor);
    shownMoves.set(device, board.revision);
    shownWinner.set(device, winnerOf(board.outcome));
    canMove.set(device, board.canMove);
  }
  return { shownMoves, shownWinner, canMove };
}

async function recordOffered(s: ProductHarness): Promise<boolean> {
  for (const actor of Object.values(ACTOR)) {
    const offered = await gameRecordOffered(s, actor);
    if (offered.gameRecord && offered.finalPosition) return true;
  }
  return false;
}

async function idleOf(s: ProductHarness): Promise<Map<string, boolean>> {
  const idle = new Map<string, boolean>();
  for (const person of PEOPLE) {
    const member = await profileIdOf(s, person);
    const observer = IDLE_FROM[person];
    idle.set(
      person,
      member !== null &&
        observer !== undefined &&
        (await personIdleShown(s, observer, member))
    );
  }
  return idle;
}

async function openSharedGame(w: QuintHarnessWorld): Promise<void> {
  await w.s.apply(prepareMultiplayerSpaceModel);
  await w.s.apply(joinMultiplayerSpace, 'carol', 'alice');
  await w.s.apply(joinMultiplayerSpace, 'dave', 'bob');
  await w.s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
  await w.s.apply(returnToTabs, 'alice_phone');
  await w.s.apply(joinMultiplayerSpace, 'alice_phone', 'alice');
}

function device(picks: Picks): string {
  return actorOf(String(picks['device']));
}

bindQuintModel<QuintHarnessWorld>({
  model: 'multiplayer-shared-game',
  traces: 96,
  maxSteps: 14,
  verifySteps: 2,
  timeoutMs: 300_000,
  actions: {
    init: (w) => openSharedGame(w),
    playMove: (w, picks: Picks) =>
      w.s.apply(changeSpaceMatch, device(picks), 'move'),
    resignPlay: (w, picks: Picks) =>
      w.s.apply(changeSpaceMatch, device(picks), 'resign'),
    goQuiet: (w, picks: Picks) =>
      w.s.apply(stayIdle, device(picks), Number(picks['minutes'])),
    loseConnection: async (w, picks: Picks) => {
      await w.s.apply(partition, device(picks));
      await w.s.advanceTime(1_000);
    },
    connectionReturns: (w, picks: Picks) =>
      w.s.apply(restoreActorConnection, device(picks)),
    copyGameRecord: (w, picks: Picks) =>
      w.s.apply(copyGameRecord, device(picks)),
  },
  observe: async (w) => {
    const shown = await w.quiet.read(boards);
    return {
      shownMoves: shown.shownMoves,
      shownWinner: shown.shownWinner,
      canMove: shown.canMove,
      gameRecordOffered: await w.quiet.read(recordOffered),
      idle: await w.quiet.read(idleOf),
    };
  },
});
