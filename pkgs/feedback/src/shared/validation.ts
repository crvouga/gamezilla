import type { FeedbackDraft } from './types';

export const EMPTY_FEEDBACK: FeedbackDraft = {
  kind: 'problem',
  title: '',
  description: '',
};
export function feedbackErrors(
  draft: FeedbackDraft
): Partial<Record<keyof FeedbackDraft, string>> {
  if (!draft.description.trim())
    return { description: 'Write something before sending feedback.' };
  if (draft.description.length > 32000)
    return { description: 'Keep feedback under 32,000 characters.' };
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
