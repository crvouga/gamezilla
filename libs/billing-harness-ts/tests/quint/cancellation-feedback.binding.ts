import {
  cancelPlus,
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { membershipShown } from '@libs/billing-harness-ts/billing-reads';
import {
  feedbackOnline,
  feedbackShown,
  settleFeedback,
  shareCancellationFeedback,
  teamFeedback,
} from '@libs/billing-harness-ts/cancellation-feedback';
import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
  restoreNetwork,
} from '@libs/harness-ts/actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

bindQuintModel<QuintHarnessWorld>({
  model: 'cancellation-feedback',
  traces: 12,
  maxSteps: 16,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(openBilling, 'alice');
      await w.s.apply(subscribeToPlus, 'alice');
      await w.s.apply(cancelPlus, 'alice');
    },
    shareCancellationFeedback: async (w, picks) => {
      await w.s.apply(
        shareCancellationFeedback,
        'alice',
        String(picks['why']),
        String(picks['words'])
      );
      await w.s.read(settleFeedback, 'alice');
    },
    _goOffline: async (w) => {
      await w.s.apply(partition, 'alice');
      await w.s.apply(refreshActorConnection, 'alice');
      await w.s.apply(refreshActorQueries, 'alice');
    },
    _goOnline: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.read(settleFeedback, 'alice');
    },
    viewBillingPlans: async (w) => {
      await w.s.apply(openBilling, 'alice');
    },
  },
  observe: async (w) => {
    const feedback = await w.quiet.read(feedbackShown, 'alice');
    if (feedback === null)
      throw new Error('Cancellation feedback is not visible');
    return {
      canceled:
        (await w.quiet.read(membershipShown, 'alice'))?.state === 'canceling',
      feedback,
      feedbackAtTeam: await w.quiet.read(teamFeedback, 'alice'),
      _online: await w.quiet.read(feedbackOnline, 'alice'),
    };
  },
});
