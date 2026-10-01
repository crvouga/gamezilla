import type { FeedbackDraft } from './types';

export const EMPTY_FEEDBACK: FeedbackDraft = {
  kind: 'problem',
  description: '',
  expected: '',
  reproductionSteps: '',
};

export function feedbackErrors(
  draft: FeedbackDraft
): Partial<Record<keyof FeedbackDraft, string>> {
  const errors: Partial<Record<keyof FeedbackDraft, string>> = {};
  if (!draft.description.trim())
    errors.description =
      draft.kind === 'problem'
        ? 'Tell us what happened.'
        : 'Describe what you would like to improve.';
  if (!draft.expected.trim())
    errors.expected =
      draft.kind === 'problem'
        ? 'Tell us what you expected to happen.'
        : 'Describe the improvement you want.';
  if (draft.kind === 'problem' && !draft.reproductionSteps.trim())
    errors.reproductionSteps =
      'Add steps to reproduce this, or record a reproduction.';
  return errors;
}

export function validateFeedback(draft: FeedbackDraft): void {
  if (!['problem', 'feature', 'gap', 'polish'].includes(draft.kind))
    throw new Error('Choose a feedback kind.');
  const error = Object.values(feedbackErrors(draft))[0];
  if (error) throw new Error(error);
  if (
    [draft.description, draft.expected, draft.reproductionSteps].some(
      (text) => text.length > 32000
    )
  )
    throw new Error('Keep each answer under 32,000 characters.');
}
