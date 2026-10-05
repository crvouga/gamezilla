// @io-wall-ok — platform root: feedback is active before app modules load

import {
  showBrowserStartupFailure,
  startBrowserApplication,
} from '@libs/app-root-client/start-browser-application';
import { feedbackEndpoint } from '@pkgs/feedback-client/endpoint';
import { bootBrowserFeedback } from '@pkgs/feedback-client/wall';

const STARTUP_RECOVERY_KEY = 'gamezilla:dev-startup-recovery';

function startApplication(): Promise<void> {
  return startBrowserApplication({
    load: () => import('./main'),
    recoverOnce: import.meta.env.DEV,
    recoveryAttempted: () =>
      sessionStorage.getItem(STARTUP_RECOVERY_KEY) === 'attempted',
    markRecoveryAttempted: () =>
      sessionStorage.setItem(STARTUP_RECOVERY_KEY, 'attempted'),
    clearRecoveryAttempted: () =>
      sessionStorage.removeItem(STARTUP_RECOVERY_KEY),
    reload: () => location.reload(),
    showFailure: (error) =>
      showBrowserStartupFailure({
        document,
        reload: () => location.reload(),
        ...(import.meta.env.DEV ? { error } : {}),
      }),
  });
}

bootBrowserFeedback({
  build: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
  endpoint: import.meta.env.DEV
    ? '/api/feedback'
    : feedbackEndpoint(import.meta.env.VITE_API_URL || location.origin),
  applicationErrorEvent: 'product-crash',
  startApplication,
});
