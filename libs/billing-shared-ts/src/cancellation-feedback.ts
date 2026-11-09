/** Person-supplied feedback is personal data, never accounting evidence. */
export const CANCELLATION_REASONS = [
  '',
  'price',
  'missing features',
  'difficulty using the app',
  'low usage',
  'switching products',
  'other',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export const CANCELLATION_COMMENT_LIMIT = 2000;

export type CancellationFeedback = {
  readonly reason: CancellationReason;
  readonly comment: string;
};

export type CancellationFeedbackRow = CancellationFeedback & {
  readonly id: string;
  readonly subscription_id: string;
  readonly account_id: string;
  readonly updated_at: string;
};
