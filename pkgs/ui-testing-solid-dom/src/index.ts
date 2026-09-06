/**
 * Solid + DOM (happy-dom) driver for `@pkgs/ui-testing`.
 *
 * In-process Solid tree actors: no browser, emulator, IPC, or HTTP server.
 * Waits are `MutationObserver` + injected pump driven (no timer polling);
 * deadlines run on an injected `Clock`.
 */

export {
  ensureElementLayout,
  type LayoutProvider,
  readInlineSize,
  synthesizeLayout,
} from './dom-layout';
export { ACTOR_ATTR, testIdSelector } from './dom-query';
export { normalizeText, readDomText } from './dom-text';
export { isDomVisible } from './dom-visibility';
export {
  DEFAULT_WAIT_TIMEOUT_MS,
  microtaskPump,
  type WaitForDomOptions,
  type WaitPump,
  waitForDom,
} from './dom-wait';
export {
  createActorContainer,
  type MountSolidAppOptions,
  mountSolidApp,
} from './mount-solid-app';
export {
  createMultiAppSolidDomSession,
  type FocusedRenderedApp,
  MULTI_APP_HOST_COMPONENT,
  type MultiAppSolidDomSession,
  type MultiAppSolidDomSessionOptions,
  type SnapshotAllActorsOptions,
} from './multi-app-solid-dom-session';
export {
  createDomUser,
  createSolidDomRenderedApp,
  type SolidDomAppScope,
  type SolidDomRenderedApp,
  type UserEvent,
} from './renderer-solid-dom';
export {
  isBlankSnapshotHtml,
  type SerializeDomHtmlOptions,
  SNAPSHOT_SHELL_CSS,
  serializeDomHtml,
} from './serialize-dom-html';
export { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';
export {
  createSolidDomDriver,
  type SolidAppHarness,
  SolidDomDriver,
  type SolidDomDriverOptions,
} from './solid-dom-driver';
export {
  SolidDomDriverNode,
  type SolidDomNodeHost,
} from './solid-dom-driver-node';
