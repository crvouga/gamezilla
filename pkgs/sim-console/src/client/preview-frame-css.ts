import { MULTI_APP_ACTOR_FRAME } from '@pkgs/ui-testing-solid-dom/snapshot-frame';

/** Dark app chrome (matches `@pkgs/ui-rn` dark palette surfaces / text). */
const SNAPSHOT_BG = 'hsla(240, 5%, 4%, 1)';
const SNAPSHOT_FG = 'hsla(0, 0%, 98%, 1)';
const BODY_FONT =
  "Nunito, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const FRAME_W = MULTI_APP_ACTOR_FRAME.width;
const FRAME_H = MULTI_APP_ACTOR_FRAME.height;

/**
 * In-DOM report preview shell (scoped to `.snapshot-host` by prepareSnapshotHtml).
 * Uses container query units so scale fits the pane, not the browser viewport.
 * Avoids sandboxed iframes — Cursor/embedded browsers often leave srcdoc panes blank.
 */
export const PREVIEW_IN_DOM_SHELL_CSS = [
  `html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;container-type:size;container-name:snapshot;color-scheme:dark;background:${SNAPSHOT_BG};color:${SNAPSHOT_FG};font-family:${BODY_FONT};}`,
  '*{box-sizing:border-box;-webkit-user-select:none;user-select:none;}',
  "input,textarea,[contenteditable='true']{-webkit-user-select:text;user-select:text;}",
  `.rn-root{position:absolute;inset:0;margin:auto;width:${FRAME_W}px;height:${FRAME_H}px;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;transform:scale(min(calc(100cqw / ${FRAME_W}px), calc(100cqh / ${FRAME_H}px)));transform-origin:center center;}`,
  '[data-component="ModalRoot"],[role="dialog"]{width:100%;height:100%;min-height:100%}',
  '[data-component="ModalBackdrop"]{width:100%;height:100%;min-height:100%}',
  'input,textarea,button,span{font:inherit;color:inherit;}',
].join('');
