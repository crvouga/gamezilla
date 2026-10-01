// @io-wall-ok — platform root: reporting is active before product modules load

import { bootBrowserRoot } from '@pkgs/bug-report/browser-root';
import { bugReportEndpoint } from '@pkgs/bug-report/client';

bootBrowserRoot({
  endpoint: import.meta.env.DEV
    ? '/api/bug-reports'
    : bugReportEndpoint(import.meta.env.VITE_API_URL || location.origin),
  startProduct: () => import('./main'),
});
