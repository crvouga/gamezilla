/** Expo web / playground — RNTL is not available. */

type MultiAppRntlSessionFactory =
  typeof import('@pkgs/ui-testing-rntl')['createMultiAppRntlSession'];

export function loadRntlSessionFactory(): MultiAppRntlSessionFactory {
  throw new Error('RNTL session factory is Node/test-only');
}
