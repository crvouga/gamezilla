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

test('paid access can start again after two completed hosting cycles', async () => {
  // regression: hosting-cancellation-waits-past-sign-in
  const world = quintWorld();
  const model = 'hosting-limits';
  const binding = quintBinding(model);
  const w = (await world.create({
    packageName: '@libs/friends',
    specUri: 'specs/spaces/hosting-limits.qnt',
    model,
    trace: 5,
    seed: '0x67932',
    testId: 'paid-access-repeated-hosting',
    title: 'Paid access after two completed hosting cycles',
  })) as QuintHarnessWorld;
  try {
    for (const action of [
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
    ]) {
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
}, 180_000);
