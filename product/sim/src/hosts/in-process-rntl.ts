/** Node / bun:test — attach MultiAppRntlSession. */

type MultiAppRntlSessionFactory =
  typeof import('@pkgs/ui-testing-rntl')['createMultiAppRntlSession'];

export function loadRntlSessionFactory(): MultiAppRntlSessionFactory {
  return require('@pkgs/ui-testing-rntl').createMultiAppRntlSession;
}
