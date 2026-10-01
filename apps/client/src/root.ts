// @io-wall-ok — platform root: reporting is active before product modules load

import { bootBrowserRoot } from '@pkgs/feedback/browser-root';
import { feedbackEndpoint } from '@pkgs/feedback/client';

bootBrowserRoot({
  build: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
  endpoint: import.meta.env.DEV
    ? '/api/feedback'
    : feedbackEndpoint(import.meta.env.VITE_API_URL || location.origin),
  startProduct: () => import('./main'),
});
