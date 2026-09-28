/**
 * WAI-ARIA 1.2 roles: which role an element has (its explicit `role`, else
 * its implicit role from HTML-AAM), and the role tables the ACT rules and the
 * name computation read.
 */

/** Every non-abstract WAI-ARIA 1.2 role (plus the DPUB-free `image` synonym). */
export const ARIA_ROLES: ReadonlySet<string> = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'image',
  'img',
  'insertion',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'meter',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
]);

/** Roles a person acts on: the widgets (ARIA 1.2 § 5.3.2, operable ones). */
export const CONTROL_ROLES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'scrollbar',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'treeitem',
]);

/** Roles whose name may come from their content (ARIA 1.2 "name from: contents"). */
export const NAME_FROM_CONTENT_ROLES: ReadonlySet<string> = new Set([
  'button',
  'cell',
  'checkbox',
  'columnheader',
  'gridcell',
  'heading',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'row',
  'rowheader',
  'switch',
  'tab',
  'tooltip',
  'treeitem',
]);

/** Composite widgets that may manage focus among their members (roving tabindex). */
export const COMPOSITE_ROLES: ReadonlySet<string> = new Set([
  'grid',
  'listbox',
  'menu',
  'menubar',
  'radiogroup',
  'tablist',
  'toolbar',
  'tree',
  'treegrid',
]);

const PRESENTATIONAL = new Set(['none', 'presentation']);

/** Global ARIA attributes whose presence overrides `role="none"` (ARIA 1.2 § 7.3). */
const GLOBAL_ARIA = [
  'aria-describedby',
  'aria-details',
  'aria-keyshortcuts',
  'aria-label',
  'aria-labelledby',
  'aria-live',
  'aria-owns',
  'aria-roledescription',
];

/** Lowercased tag name (`BUTTON` → `button`), namespace-agnostic. */
export function tagOf(element: Element): string {
  return element.localName.toLowerCase();
}

/** The first valid token of the `role` attribute, or `null`. */
export function explicitRoleOf(element: Element): string | null {
  const raw = element.getAttribute('role');
  if (raw === null) return null;
  for (const token of raw.trim().toLowerCase().split(/\s+/)) {
    if (ARIA_ROLES.has(token)) return token === 'image' ? 'img' : token;
  }
  return null;
}

const INPUT_ROLES: Readonly<Record<string, string>> = {
  button: 'button',
  checkbox: 'checkbox',
  image: 'button',
  number: 'spinbutton',
  radio: 'radio',
  range: 'slider',
  reset: 'button',
  search: 'searchbox',
  submit: 'button',
};

function inputRole(element: Element): string | null {
  const type = (element.getAttribute('type') ?? 'text').toLowerCase();
  if (type === 'hidden') return null;
  if (element.hasAttribute('list') && type !== 'range') return 'combobox';
  return INPUT_ROLES[type] ?? 'textbox';
}

const SECTIONING = 'article, aside, main, nav, section';

function landmarkUnlessScoped(element: Element, role: string): string {
  const scope = element.parentElement?.closest(SECTIONING) ?? null;
  return scope === null ? role : 'generic';
}

const TAG_ROLES: Readonly<Record<string, string>> = {
  article: 'article',
  aside: 'complementary',
  blockquote: 'blockquote',
  button: 'button',
  code: 'code',
  del: 'deletion',
  details: 'group',
  dialog: 'dialog',
  em: 'emphasis',
  fieldset: 'group',
  figure: 'figure',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  hr: 'separator',
  ins: 'insertion',
  li: 'listitem',
  main: 'main',
  math: 'math',
  menu: 'list',
  meter: 'meter',
  nav: 'navigation',
  ol: 'list',
  optgroup: 'group',
  option: 'option',
  output: 'status',
  p: 'paragraph',
  progress: 'progressbar',
  search: 'search',
  strong: 'strong',
  sub: 'subscript',
  summary: 'button',
  sup: 'superscript',
  table: 'table',
  tbody: 'rowgroup',
  td: 'cell',
  textarea: 'textbox',
  tfoot: 'rowgroup',
  th: 'columnheader',
  thead: 'rowgroup',
  time: 'time',
  tr: 'row',
  ul: 'list',
};

function namedRegion(element: Element, role: string): string {
  const named =
    element.hasAttribute('aria-label') ||
    element.hasAttribute('aria-labelledby');
  return named ? role : 'generic';
}

function imgRole(element: Element): string {
  return element.getAttribute('alt') === '' ? 'presentation' : 'img';
}

function selectRole(element: Element): string {
  const size = Number(element.getAttribute('size') ?? '0');
  return element.hasAttribute('multiple') || size > 1 ? 'listbox' : 'combobox';
}

/** The role HTML-AAM maps the element to without a `role` attribute. */
export function implicitRoleOf(element: Element): string | null {
  const tag = tagOf(element);
  if (tag === 'a' || tag === 'area') {
    return element.hasAttribute('href') ? 'link' : 'generic';
  }
  if (tag === 'input') return inputRole(element);
  if (tag === 'img') return imgRole(element);
  if (tag === 'select') return selectRole(element);
  if (tag === 'header') return landmarkUnlessScoped(element, 'banner');
  if (tag === 'footer') return landmarkUnlessScoped(element, 'contentinfo');
  if (tag === 'section') return namedRegion(element, 'region');
  if (tag === 'form') return namedRegion(element, 'form');
  if (tag === 'div' || tag === 'span') return 'generic';
  return TAG_ROLES[tag] ?? null;
}

function hasGlobalAria(element: Element): boolean {
  return GLOBAL_ARIA.some((name) => element.hasAttribute(name));
}

function natively(element: Element): boolean {
  const tag = tagOf(element);
  if (tag === 'a' || tag === 'area') return element.hasAttribute('href');
  return ['button', 'input', 'select', 'textarea', 'summary'].includes(tag);
}

/**
 * The element's semantic role: its explicit role, except that `none` /
 * `presentation` is ignored on a focusable element or one with a global ARIA
 * attribute (ARIA 1.2 § 7.3 "presentational roles conflict resolution").
 */
export function roleOf(element: Element): string | null {
  const explicit = explicitRoleOf(element);
  if (explicit === null) return implicitRoleOf(element);
  if (!PRESENTATIONAL.has(explicit)) return explicit;
  const conflict =
    natively(element) ||
    element.hasAttribute('tabindex') ||
    hasGlobalAria(element);
  return conflict ? implicitRoleOf(element) : 'presentation';
}

/** `none`, `presentation` and `generic` add nothing to the accessibility tree. */
export function isTransparentRole(role: string | null): boolean {
  return role === null || role === 'generic' || PRESENTATIONAL.has(role);
}
