import { leaveChessMenuToGameMenu } from '@libs/chess-puzzle-harness/chess-actions';
import { readPuzzleView } from '@libs/chess-puzzle-harness/puzzle-control-reads';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  createSpace,
  joinViaLink,
  returnToOwnSpace,
  selectChessGame,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const DEVICE_ACTOR = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
} as const;

function deviceActor(picks: Picks): string {
  const name = String(picks['device']);
  const actor = DEVICE_ACTOR[name as keyof typeof DEVICE_ACTOR];
  if (actor === undefined) throw new Error(`Unknown device ${name}`);
  return actor;
}

async function spaceView(w: QuintHarnessWorld, actor: string): Promise<string> {
  const shown = await w.quiet.read(readPuzzleView, actor);
  return shown === 'ChessChoices' ? 'chess' : 'choice';
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-follow',
  traces: 32,
  maxSteps: 24,
  actions: {
    init: async (w) => {
      await prepareNamedFriend(w.s, 'alice');
      await w.s.apply(createSpace, 'alice');
      const link = await w.s.read(readSpaceLink, 'alice');
      if (link === null) throw new Error('alice opened no space');
      await prepareNamedFriend(w.s, 'bob');
      await w.s.apply(joinViaLink, 'bob', link);
      await w.s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
      await w.s.apply(returnToTabs, 'alice_phone');
      await w.s.apply(returnToOwnSpace, 'alice_phone');
    },
    pickChess: (w, picks) => w.s.apply(selectChessGame, deviceActor(picks)),
    backToGameChoice: (w, picks) =>
      w.s.apply(leaveChessMenuToGameMenu, deviceActor(picks)),
    goQuiet: (w) => w.s.advanceTime(1_000),
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
  },
  observe: async (w) => {
    const view = new Map<string, string>();
    for (const [device, actor] of Object.entries(DEVICE_ACTOR))
      view.set(device, await spaceView(w, actor));
    return { view };
  },
});
