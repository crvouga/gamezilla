// @io-wall-ok — platform root: feedback is active before app modules load

import { feedbackEndpoint } from '@pkgs/feedback-client/endpoint';
import { bootBrowserFeedback } from '@pkgs/feedback-client/wall';

bootBrowserFeedback({
  build: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
  endpoint: import.meta.env.DEV
    ? '/api/feedback'
    : feedbackEndpoint(import.meta.env.VITE_API_URL || location.origin),
  applicationErrorEvent: 'product-crash',
  startApplication: () => import('./main'),
});
