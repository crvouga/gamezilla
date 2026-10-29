// @io-wall-ok — platform root: feedback is active before app modules load

import {
  showBrowserStartupFailure,
  startBrowserApplication,
  startupFailureReference,
} from '@libs/app-root-client-ts/start-browser-application';
import {
  createWallOfflineHttp,
  wallCreateId,
} from '@libs/app-root-client-ts/wall-client-env';
import { wallOfflineNetworkController } from '@libs/app-root-client-ts/wall-offline-network';
import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import { feedbackEndpoint } from '@pkgs/feedback-client-ts/endpoint';
import { bootBrowserFeedback } from '@pkgs/feedback-client-ts/wall';

const STARTUP_RECOVERY_KEY = technicalKey('dev-startup-recovery', ':');
const offline = wallOfflineNetworkController();
const startupHttp = createWallOfflineHttp(offline);

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
        development: import.meta.env.DEV,
        reference: startupFailureReference(
          import.meta.env.VITE_COMMIT_HASH ?? '',
          wallCreateId
        ),
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
  http: startupHttp,
  startApplication,
});
