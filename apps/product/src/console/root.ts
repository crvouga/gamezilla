// @io-wall-ok — platform root: reporting is active before product modules load
import { bootBrowserRoot } from '@pkgs/bug-report/browser-root';

bootBrowserRoot({
  endpoint: import.meta.env.DEV
    ? '/api/bug-reports'
    : new URL(
        '/api/bug-reports',
        import.meta.env.VITE_API_URL || location.origin
      ).href,
  startProduct: () => import('./main'),
});
