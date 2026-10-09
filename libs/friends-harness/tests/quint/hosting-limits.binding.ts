import {
  observeMembership,
  openBilling,
  providerEvent,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import { letTimePass, partition, restoreNetwork } from '@libs/harness/actions';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { backToTabs } from '@libs/harness/shell-actions';
import {
  endSpace,
  openSpaceLink,
  openSpacesTab,
  returnToLobby,
  startSpace,
} from '@libs/spaces-harness/space-actions';
import { returnToRetainedSpace } from '@libs/spaces-harness/space-retained-actions';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import {
  hostedSpaceCount,
  hostingLimitShown,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { variant } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const ACTOR = 'alice';
const LINKS = 'hosting-limit-links';
const DAY_MS = 24 * 60 * 60 * 1_000;

function links(w: QuintHarnessWorld): readonly string[] {
  return (w.memo.get(LINKS) as readonly string[] | undefined) ?? [];
}

async function changeAccess(
  w: QuintHarnessWorld,
  operation: () => Promise<void>
): Promise<void> {
  const screen = await w.s.read(spaceScreenOf, ACTOR);
  const link = await w.s.read(readSpaceLink, ACTOR);
  await operation();
  await w.s.apply(backToTabs, ACTOR);
  if (screen === 'lobby') await w.s.apply(openSpacesTab, ACTOR);
  else if (link !== null) await w.s.apply(openSpaceLink, ACTOR, link);
  else throw new Error(`No space to return to from ${screen}`);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'hosting-limits',
  traces: 32,
  maxSteps: 24,
  inductiveInvariant: '_inductive',
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, ACTOR);
      await w.s.apply(openSpacesTab, ACTOR);
      w.memo.set(LINKS, []);
    },
    createSpace: async (w) => {
      await w.s.apply(startSpace, ACTOR);
      const link = await w.s.read(readSpaceLink, ACTOR);
      if (link !== null) w.memo.set(LINKS, [...links(w), link]);
    },
    stepOut: async (w) => {
      await w.s.apply(returnToLobby, ACTOR);
    },
    returnToSpace: async (w) => {
      const link = links(w).at(-1);
      if (link === undefined) throw new Error('No retained space to select');
      await w.s.apply(returnToRetainedSpace, ACTOR, link);
    },
    endSpace: async (w) => {
      const link = await w.s.read(readSpaceLink, ACTOR);
      await w.s.apply(endSpace, ACTOR);
      w.memo.set(
        LINKS,
        links(w).filter((retained) => retained !== link)
      );
    },
    goBackToLobby: async (w) => {
      await w.s.apply(openSpacesTab, ACTOR);
    },
    PaidAccessStarted: async (w) => {
      await changeAccess(w, async () => {
        await w.s.apply(openBilling, ACTOR);
        await w.s.apply(subscribeToPlus, ACTOR);
      });
    },
    PaidAccessEnded: async (w) => {
      await changeAccess(w, async () => {
        await w.s.apply(observeMembership, ACTOR, 'cancel_now');
        await w.s.apply(providerEvent, ACTOR, 'run_out_period');
        await w.s.apply(letTimePass, 8 * DAY_MS);
        await w.s.apply(openBilling, ACTOR);
        await w.s.until((s) => billingTier(s, ACTOR), { maxMs: 20_000, pred: (tier) => tier === 'free' });
      });
    },
    loseConnection: async (w) => {
      await w.s.apply(partition, ACTOR);
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(2_000);
    },
  },
  observe: async (w) => {
    const screen = await w.quiet.read(spaceScreenOf, ACTOR);
    const names = { lobby: 'Lobby', space: 'InSpace', ended: 'Ended' } as const;
    return {
      whereabouts: variant(
        screen in names ? names[screen as keyof typeof names] : 'Elsewhere'
      ),
      hostedSpaces: await w.quiet.read(hostedSpaceCount, ACTOR),
      invitedToPlus: await w.quiet.read(hostingLimitShown, ACTOR),
    };
  },
});
