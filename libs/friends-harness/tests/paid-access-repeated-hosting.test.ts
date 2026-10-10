import { expect, test } from 'bun:test';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { billingMembershipDiagnostics } from '@libs/billing-harness/billing-membership-diagnostics';
import { billingButtonEnabled } from '@libs/billing-harness/billing-reads';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { backToTabs } from '@libs/harness/shell-actions';
import {
  openSpacesTab,
  returnToLobby,
  startSpace,
} from '@libs/spaces-harness/space-actions';
import {
  activeSpaceVisible,
  hostedSpaceCount,
} from '@libs/spaces-harness/spaces-ui-reads';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import './quint/index';

const CASES = [
  {
    trace: 1,
    actions: [
      'init',
      'PaidAccessStarted',
      'createSpace',
      'endSpace',
      'PaidAccessEnded',
      'PaidAccessStarted',
      'PaidAccessEnded',
      'goBackToLobby',
    ],
  },
  {
    trace: 5,
    actions: [
      'init',
      'PaidAccessStarted',
      'loseConnection',
      'createSpace',
      'endSpace',
      'connectionReturns',
      'PaidAccessEnded',
      'goBackToLobby',
      'createSpace',
      'PaidAccessStarted',
      'loseConnection',
      'endSpace',
      'PaidAccessEnded',
      'connectionReturns',
      'loseConnection',
      'goBackToLobby',
      'connectionReturns',
      'loseConnection',
      'connectionReturns',
    ],
  },
] as const;

test.each(CASES)(
  'paid access starts again after hosting trace $trace',
  async (example) => {
    // regression: hosting-cancellation-waits-past-sign-in
    const world = quintWorld();
    const model = 'hosting-limits';
    const binding = quintBinding(model);
    const w = (await world.create({
      packageName: '@libs/friends',
      specUri: 'specs/spaces/hosting-limits.qnt',
      model,
      trace: example.trace,
      seed: '0x67932',
      testId: `paid-access-repeated-hosting-${example.trace}`,
      title: 'Paid access after two completed hosting cycles',
    })) as QuintHarnessWorld;
    try {
      for (const action of example.actions) {
        await binding.actions[action]!(w, {});
      }
      await w.s.apply(openBilling, 'alice');
      await w.s.until((s) => billingButtonEnabled(s, 'alice', 'subscribe'), {
        maxMs: 10_000,
      });
      expect(await w.s.read(billingButtonEnabled, 'alice', 'subscribe')).toBe(
        true
      );
      await w.s.apply(subscribeToPlus, 'alice');
      await w.s.apply(backToTabs, 'alice');
      await w.s.apply(openSpacesTab, 'alice');
      await w.s.apply(startSpace, 'alice');
      expect(await w.s.read(activeSpaceVisible, 'alice')).toBe(true);
      await w.s.apply(returnToLobby, 'alice');
      expect(await w.s.read(hostedSpaceCount, 'alice')).toBe(1);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n${await w.s.read(billingMembershipDiagnostics, 'alice')}`
      );
    } finally {
      await world.dispose(w);
    }
  },
  180_000
);
