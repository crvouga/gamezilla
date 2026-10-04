import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  partition,
  restoreActorConnection,
} from '@libs/harness/actions';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinViaLink,
  leaveSpace,
  openSpaceMembers,
} from '@libs/spaces-harness/space-actions';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import { openSpaceHosts } from '@libs/spaces-harness/space-state-reads';
import {
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces-harness/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const PEOPLE = ['alice', 'bob', 'carol'] as const;

async function closeMembers(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  if ((await w.s.read(spaceScreenOf, actor)) === 'viewingPresence') {
    await w.s.apply(closeSpaceMembers, actor);
  }
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-recovery',
  traces: 64,
  maxSteps: 32,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const actor of PEOPLE) await w.s.apply(signInWithGoogle, actor);
      await w.s.apply(createSpace, 'alice');
      const link = await w.s.read(readSpaceLink, 'alice');
      if (link === null) throw new Error('Alice opened no space');
      for (const actor of ['bob', 'carol'])
        await w.s.apply(joinViaLink, actor, link);
      for (const actor of PEOPLE) await w.s.apply(openSpaceMembers, actor);
    },
    leave: async (w, picks) => {
      const actor = String(picks['person']);
      await closeMembers(w, actor);
      await w.s.apply(leaveSpace, actor);
    },
    endSpace: async (w) => {
      await closeMembers(w, 'alice');
      await w.s.apply(endSpace, 'alice');
    },
    leaveHost: async (w) => {
      await closeMembers(w, 'alice');
      await w.s.apply(leaveSpace, 'alice');
    },
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(2_000);
    },
    _connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, String(picks['person']));
      await w.s.advanceTime(2_000);
    },
    _wait: async (w) => {
      await w.s.advanceTime(1_000);
    },
  },
  observe: async (w) => {
    const whereabouts = new Map<QuintValue, QuintValue>();
    const presence = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const screen = await w.quiet.read(spaceScreenOf, actor);
      const where =
        screen === 'space' || screen === 'viewingPresence'
          ? 'InSpace'
          : screen === 'left'
            ? 'Left'
            : screen === 'ended'
              ? 'Ended'
              : 'Elsewhere';
      whereabouts.set(actor, variant(where));
      presence.set(
        actor,
        screen === 'viewingPresence'
          ? ((await w.quiet.read(readSpacePresenceCount, actor)) ?? -1)
          : 0
      );
    }
    const openSpaces = await w.quiet.read(openSpaceHosts, PEOPLE);
    return { openSpaces, whereabouts, presence };
  },
});
