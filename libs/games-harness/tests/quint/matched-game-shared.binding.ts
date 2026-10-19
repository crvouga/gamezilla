/**
 * `specs/games/matched-game-shared.qnt` against one matched game of the
 * trace's game both spaces show. Guests watch. An offline device keeps the
 * last board it showed. Quiet minutes add up: one is not idle, and two is.
 */

import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness/multiplayer-board';
import {
  copyShownMultiplayerText,
  gameRecordOffered,
} from '@libs/game-matchmaking-harness/multiplayer-game-record';
import { openFindingAnOpponentIfAny } from '@libs/game-matchmaking-harness/opponent-seeking';
import { partition } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { profileIdOf } from '@libs/profile-harness/profile-ui-reads';
import {
  restoreSpaceConnection,
  stayIdle,
} from '@libs/spaces-harness/space-idle-actions';
import { personIdleShown } from '@libs/spaces-harness/space-idle-reads';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import idleCase1 from './fixtures/multiplayer-idle-agrees-across-own-devices.itf.json';
import idleTrace from './fixtures/multiplayer-idle-read-does-not-wake-person.itf.json';

import idleCase0 from './fixtures/multiplayer-idle-survives-host-return.itf.json';
import idleCase2 from './fixtures/multiplayer-idle-survives-other-host-return.itf.json';
import quietMinutes from './fixtures/multiplayer-quiet-minutes-stay-on-one-device.itf.json';
import {
  changeSpacesMatch,
  prepareMatchedSpaces,
  readSpacesMatch,
} from './matched-game-spaces-world';
import { modelGameOf } from './model-game';

const ACTOR: Record<string, string> = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
  'carol-phone': 'carol',
  'dave-phone': 'dave',
};

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;
const DEVICES_OF: Record<string, readonly string[]> = {
  alice: ['alice', 'alice_phone'],
  bob: ['bob'],
  carol: ['carol'],
  dave: ['dave'],
};

function actorOf(device: string): string {
  const actor = ACTOR[device];
  if (actor === undefined) throw new Error(`unknown device ${device}`);
  return actor;
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
    let shown = false;
    if (member !== null) {
      for (const observer of DEVICES_OF[person] ?? []) {
        if (await personIdleShown(s, observer, member)) {
          shown = true;
          break;
        }
      }
    }
    idle.set(person, shown);
  }
  return idle;
}

async function openSharedGame(w: QuintHarnessWorld): Promise<void> {
  await prepareMatchedSpaces(w);
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
  model: 'matched-game-shared',
  traces: 96,
  maxSteps: 14,
  verifySteps: 2,
  timeoutMs: 300_000,
  regressions: [
    {
      // regression: multiplayer-idle-survives-host-return
      id: 'multiplayer-idle-survives-host-return',
      title: 'Quiet time survives unrelated device reconnection',
      seed: '0x67932',
      itf: idleCase0,
    },
    {
      // regression: multiplayer-idle-agrees-across-own-devices
      id: 'multiplayer-idle-agrees-across-own-devices',
      title: 'Quiet time survives unrelated device reconnection',
      seed: '0x67932',
      itf: idleCase1,
    },
    {
      // regression: multiplayer-idle-survives-other-host-return
      id: 'multiplayer-idle-survives-other-host-return',
      title: 'Quiet time survives unrelated device reconnection',
      seed: '0x67932',
      itf: idleCase2,
    },
    {
      // regression: multiplayer-quiet-minutes-stay-on-one-device
      id: 'multiplayer-quiet-minutes-stay-on-one-device',
      title: 'One device waiting does not add quiet minutes to other devices',
      seed: '0x67932',
      itf: quietMinutes,
    },
    {
      // regression: multiplayer-idle-read-does-not-wake-person
      id: 'multiplayer-idle-read-does-not-wake-person',
      title: 'A disconnected observer does not hide another person being idle',
      seed: '0x67932',
      itf: idleTrace,
    },
  ],
  actions: {
    init: (w) => openSharedGame(w),
    playMove: (w, picks: Picks) => changeSpacesMatch(w, device(picks), 'move'),
    resignGame: (w, picks: Picks) =>
      changeSpacesMatch(w, device(picks), 'resign'),
    goQuiet: (w, picks: Picks) =>
      w.s.apply(stayIdle, device(picks), Number(picks['minutes'])),
    loseConnection: async (w, picks: Picks) => {
      await w.s.apply(partition, device(picks));
      await w.s.advanceTime(1_000);
    },
    connectionReturns: (w, picks: Picks) =>
      w.s.apply(restoreSpaceConnection, device(picks)),
    copyGameRecord: async (w, picks: Picks) => {
      await w.s.apply(
        openFindingAnOpponentIfAny,
        device(picks),
        modelGameOf(w).shared.id
      );
      await w.s.apply(copyShownMultiplayerText, device(picks), 'game record');
    },
  },
  observe: async (w) => {
    const shown = await readSpacesMatch(w, ACTOR);
    return {
      shownMoves: shown.shownMoves,
      shownWinner: shown.shownWinner,
      canMove: shown.canMove,
      gameRecordOffered: await w.quiet.read(recordOffered),
      idle: await w.quiet.read(idleOf),
    };
  },
});
