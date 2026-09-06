import { MULTI_APP_ACTOR_FRAME } from './snapshot-frame';

export type SerializeDomHtmlOptions = {
  /**
   * When set, shell chrome CSS is linked instead of inlined (smaller frames
   * in multi-snapshot reports). Standalone callers omit this.
   */
  readonly stylesheetHref?: string | undefined;
};

const SNAPSHOT_BG = 'hsla(240, 5%, 4%, 1)';
const SNAPSHOT_FG = 'hsla(0, 0%, 98%, 1)';
const BODY_FONT =
  "Nunito, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FRAME_W = MULTI_APP_ACTOR_FRAME.width;
const FRAME_H = MULTI_APP_ACTOR_FRAME.height;

/** Shell CSS shared by report frames when using `stylesheetHref`. */
export const SNAPSHOT_SHELL_CSS = [
  `html,body{width:${FRAME_W}px;height:${FRAME_H}px;margin:0;padding:0;overflow:hidden;position:relative;color-scheme:dark;background:${SNAPSHOT_BG};color:${SNAPSHOT_FG};font-family:${BODY_FONT};}`,
  '*{box-sizing:border-box;-webkit-user-select:none;user-select:none;}',
  "input,textarea,[contenteditable='true']{-webkit-user-select:text;user-select:text;}",
  `.dom-root{width:${FRAME_W}px;height:${FRAME_H}px;display:flex;flex-direction:column;flex:1;min-height:100%;box-sizing:border-box;overflow:hidden;position:relative;}`,
  'input,textarea,button,span{font:inherit;color:inherit;}',
].join('');

/** Launch / nav shells are ~3KB of empty flex chrome with no visible copy. */
const SHELL_ONLY_BODY_MAX = 4000;

/**
 * True when snapshot HTML has no visible text (empty / spinner shell).
 * Used to avoid caching or writing blank parked-actor report views.
 */
export function isBlankSnapshotHtml(html: string | undefined): boolean {
  if (html === undefined || html.trim() === '') return true;
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const bodyHtml = bodyMatch?.[1] ?? html;
  const text = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (text.length === 0) return true;
  if (bodyHtml.length < SHELL_ONLY_BODY_MAX && text.length < 8) return true;
  return false;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FONT_LINKS = [
  '<link rel="preconnect" href="https://fonts.googleapis.com" />',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap" />',
];

/**
 * Serialize the actor's rendered DOM (container plus body-level portal nodes
 * it owns) into a standalone HTML document for simulation reports.
 */
export function serializeDomHtml(
  nodes: readonly Element[],
  options: SerializeDomHtmlOptions = {}
): string {
  const body = nodes.map((node) => node.outerHTML).join('');
  const styleBlock =
    options.stylesheetHref !== undefined
      ? `<link rel="stylesheet" href="${escapeAttr(options.stylesheetHref)}" />`
      : `<style>${SNAPSHOT_SHELL_CSS}</style>`;
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="dark" />',
    '<title>UI snapshot</title>',
    ...FONT_LINKS,
    styleBlock,
    '</head>',
    `<body><div class="dom-root">${body}</div></body>`,
    '</html>',
  ].join('');
}
