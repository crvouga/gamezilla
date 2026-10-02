import type { FeedbackDraft } from './types';

export const EMPTY_FEEDBACK: FeedbackDraft = {
  kind: 'problem',
  title: '',
  body: '',
};
export function feedbackErrors(
  draft: FeedbackDraft
): Partial<Record<keyof FeedbackDraft, string>> {
  if (!draft.body.trim())
    return { body: 'Write something before sending feedback.' };
  if (draft.body.length > 32000)
    return { body: 'Keep feedback under 32,000 characters.' };
  if (draft.title.length > 240)
    return { title: 'Keep the title under 240 characters.' };
  return {};
}
export function validateFeedback(draft: FeedbackDraft): void {
  if (!['problem', 'feature', 'gap', 'polish'].includes(draft.kind))
    throw new Error('Choose a feedback kind.');
  const error = Object.values(feedbackErrors(draft))[0];
  if (error) throw new Error(error);
}
