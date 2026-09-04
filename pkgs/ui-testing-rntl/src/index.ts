/**
 * React Native Testing Library driver for `@pkgs/ui-testing`.
 *
 * In-process React tree actors: no browser, emulator, IPC, or HTTP server.
 * Waits drive an injected {@link WaitPump} plus a React flush rather than
 * RNTL `findBy` / `waitFor` wall sleeps.
 */

export {
  actorShellTestId,
  MULTI_APP_ACTOR_FRAME,
  MULTI_APP_ACTOR_SHELL_PREFIX,
  MULTI_APP_HOST_TEST_ID,
  MultiAppHost,
} from './multi-app-rntl-host';
export {
  createMultiAppRntlSession,
  type FocusedRenderedApp,
  type MultiAppRntlSession,
  type MultiAppRntlSessionOptions,
  type SnapshotAllActorsOptions,
} from './multi-app-rntl-session';
export {
  createRenderedAppFromQueryScope,
  createRenderedAppFromRntl,
  createRntlRenderAdapter,
} from './renderer-rntl';
export { RntlDriver, type RntlDriverOptions } from './rntl-driver';
export {
  type SerializeHostTreeHtmlOptions,
  SNAPSHOT_SHELL_CSS,
  serializeHostTreeHtml,
} from './serialize-host-tree-html';
