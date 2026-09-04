/**
 * Browser backend for `@pkgs/secure-storage`: `localStorage`, except tab-scoped
 * keys (e.g. `lastLocalAccountId`) which use `sessionStorage`.
 */

export {
  clearNamespacedWebSecureStorage,
  createNamespacedWebSecureStorage,
  createWebSecureStorage,
} from './impl-web';
