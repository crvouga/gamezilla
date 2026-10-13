import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { copyGameRecord } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
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
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { partitioned } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { profileIdOf } from '@libs/profile-harness/profile-ui-reads';
import {
  returnToOwnSpace,
  stayQuiet,
} from '@libs/spaces-harness/space-actions';
import { presenceIdle } from '@libs/spaces-harness/space-device-reads';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const DEVICE_ACTOR = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
  'carol-phone': 'carol',
  'dave-phone': 'dave',
} as const;

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

function deviceActor(picks: Picks): string {
  const name = String(picks['device']);
  const actor = DEVICE_ACTOR[name as keyof typeof DEVICE_ACTOR];
  if (actor === undefined) throw new Error(`Unknown device ${name}`);
  return actor;
}

function minutesOf(picks: Picks): number {
  return Number(picks['minutes']);
}

function actorIsOffline(s: ProductHarness, actorId: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(actorId));
}

function winnerOf(outcome: string | null): string {
  if (outcome === 'white') return 'alice';
  if (outcome === 'black') return 'bob';
  return 'nobody';
}

bindQuintModel<QuintHarnessWorld>({
  model: 'multiplayer-shared-game',
  traces: 32,
  maxSteps: 24,
  actions: {
    init: async (w) => {
      // A day per move: two quiet minutes do not miss the first move.
      await w.s.apply(prepareMultiplayerSpaceModel, '1d');
      await w.s.apply(joinMultiplayerSpace, 'carol', 'alice');
      await w.s.apply(signInWithGoogle, 'dave');
      await w.s.apply(joinMultiplayerSpace, 'dave', 'bob');
      await w.s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
      await w.s.apply(returnToTabs, 'alice_phone');
      await w.s.apply(returnToOwnSpace, 'alice_phone');
      for (const actor of [...PEOPLE, 'alice_phone'])
        await w.s.apply(openMultiplayerChess, actor);
    },
    playMove: (w, picks) =>
      w.s.apply(changeSpaceMatch, deviceActor(picks), 'move'),
    resignPlay: (w, picks) =>
      w.s.apply(changeSpaceMatch, deviceActor(picks), 'resign'),
    goQuiet: (w, picks) =>
      w.s.apply(stayQuiet, deviceActor(picks), minutesOf(picks)),
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
    copyGameRecord: async (w, picks) => {
      const actor = deviceActor(picks);
      // Copying changes nothing. A device with no connection keeps its last
      // board and is not offered the record it never received.
      if (await w.s.read(actorIsOffline, actor)) return;
      await w.s.apply(copyGameRecord, actor);
    },
  },
  observe: async (w) => {
    const shownMoves = new Map<string, number>();
    const shownWinner = new Map<string, string>();
    const canMove = new Map<string, boolean>();
    let gameRecordOffered = false;
    for (const [device, actor] of Object.entries(DEVICE_ACTOR)) {
      const board = await w.quiet.read(multiplayerWatcherBoard, actor);
      const moves = board.revision < 0 ? 0 : board.revision;
      shownMoves.set(device, moves);
      const winner = winnerOf(board.outcome);
      shownWinner.set(device, winner);
      canMove.set(device, board.canMove);
      if (winner !== 'nobody') gameRecordOffered = true;
    }
    const idle = new Map<string, boolean>();
    const idleIds = new Set<string>();
    for (const actor of [...PEOPLE, 'alice_phone']) {
      for (const id of await w.quiet.read(presenceIdle, actor)) idleIds.add(id);
    }
    for (const person of PEOPLE) {
      const id = await w.quiet.read(profileIdOf, person);
      idle.set(person, id !== null && idleIds.has(id));
    }
    return { shownMoves, shownWinner, canMove, gameRecordOffered, idle };
  },
});
