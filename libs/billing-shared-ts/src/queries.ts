import { myCancellationFeedback } from './my-cancellation-feedback-query';
import { mySubscription } from './my-subscription-query';

export const BILLING_QUERIES = [
  mySubscription,
  myCancellationFeedback,
] as const;
