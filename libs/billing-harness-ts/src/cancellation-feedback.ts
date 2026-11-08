import { cancellationFeedbackReport } from '@libs/billing-server-ts/cancellation-feedback-report';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { partitioned } from '@libs/harness-ts/observations';
import { cancelPlus, openBilling, subscribeToPlus } from './billing-actions';

const REASON_LABELS: Readonly<Record<string, string>> = {
  '': 'Prefer not to say',
  price: 'Too expensive',
  'missing features': 'Missing features',
  'difficulty using the app': 'Difficult to use',
  'low usage': 'Not using it enough',
  'switching products': 'Using something else',
  other: 'Another reason',
};

export const shareCancellationFeedback = scenarioAction({
  name: 'shareCancellationFeedback',
  act: async (s, actor: string, reason: string, comment: string) => {
    const ui = await actorUi(s, actor);
    if (!(await ui.get('billing-cancellation-feedback').isVisible()))
      await openBilling.act(s, actor);
    await ui.get('billing-feedback-reason').tap();
    await ui
      .get(
        `billing-feedback-option-${reason === '' ? 'none' : reason.replaceAll(' ', '-')}`
      )
      .tap();
    await ui.get('billing-feedback-comment').clear();
    await ui.get('billing-feedback-comment').input(comment);
    await ui.get('billing-feedback-save').tap();
    await ui.get('billing-feedback-saved').expect.visible();
  },
});

export const setupCancellationFeedback = scenarioAction({
  name: 'setupCancellationFeedback',
  act: async (s, actor: string, reason: string, comment: string) => {
    const ui = await actorUi(s, actor);
    if (!(await ui.get('billing-cancellation-feedback').isVisible())) {
      await signInWithGoogle.act(s, actor);
      await openBilling.act(s, actor);
      await subscribeToPlus.act(s, actor);
      await cancelPlus.act(s, actor);
    }
    await shareCancellationFeedback.act(s, actor, reason, comment);
  },
});

export async function feedbackOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return (await actorUi(s, actor))
    .get('billing-cancellation-feedback')
    .isVisible();
}

export async function feedbackShown(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  if (!(await ui.get('billing-cancellation-feedback').isVisible())) return null;
  const label = await ui.get('billing-feedback-reason').text();
  const reason = Object.entries(REASON_LABELS).find(([, value]) =>
    label?.includes(value)
  )?.[0];
  return {
    reason: reason ?? '',
    comment: (await ui.get('billing-feedback-comment').text()) ?? '',
    shared: await ui.get('billing-feedback-saved').isVisible(),
  };
}

export async function teamFeedback(s: ProductHarness, actor: string) {
  const account = await signedInAccountOf(s, actor);
  const rows = await cancellationFeedbackReport(s.harness.serverSql.sqlClient);
  const row = rows.find((entry) => entry.account_id === account);
  return row === undefined
    ? { reason: '', comment: '', shared: false }
    : { reason: row.reason, comment: row.comment, shared: true };
}

export function feedbackOnline(s: ProductHarness, actor: string): boolean {
  return !partitioned(s).some((pair) => pair.split('|').includes(actor));
}

/** Wait for the connected person's queued answer to reach the team. */
export async function settleFeedback(
  s: ProductHarness,
  actor: string
): Promise<void> {
  if (!feedbackOnline(s, actor)) return;
  await pollUntil(
    s,
    async () => {
      const local = await feedbackShown(s, actor);
      const team = await teamFeedback(s, actor);
      return local !== null &&
        local.reason === team.reason &&
        local.comment === team.comment &&
        local.shared === team.shared
        ? true
        : null;
    },
    { maxMs: 30_000, description: 'cancellation feedback reaches the team' }
  );
}

export const showSavedCancellationFeedback = scenarioAction({
  name: 'showSavedCancellationFeedback',
  act: async (s, actor: string) => {
    if (!(await feedbackOffered(s, actor))) await openBilling.act(s, actor);
    await pollUntil(
      s,
      async () => ((await feedbackShown(s, actor))?.shared ? true : null),
      { maxMs: 30_000, description: 'saved cancellation feedback' }
    );
  },
});
