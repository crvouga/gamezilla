import { readDomInventory } from '@pkgs/ui-testing-root-shared-ts/dom-inventory';
import { z } from 'zod';

export const inspectionSchema = z.object({
  capturedAtMs: z.number().nonnegative(),
  generation: z.number().int().positive(),
  route: z.string().max(2048),
  html: z.string().max(200_000),
  state: z.string().max(128),
  transitions: z.array(z.string().max(128)).max(32),
  controls: z
    .array(
      z.object({
        testId: z.string().max(128),
        role: z.string().max(64),
        name: z.string().max(256),
      })
    )
    .max(200),
  actions: z
    .array(
      z.object({
        atMs: z.number(),
        action: z.string().max(256),
        outcome: z.enum(['started', 'completed', 'failed']),
      })
    )
    .max(50),
});
export type Inspection = z.infer<typeof inspectionSchema>;

export function redactDiagnostic(
  text: string,
  secrets: readonly string[] = []
): string {
  const scrubbed = secrets
    .filter(Boolean)
    .reduce(
      (value, secret) => value.replaceAll(secret, '[redacted credential]'),
      text
    );
  return scrubbed
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
    .replace(/Bearer\s+\S+/gi, '[redacted token]')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[redacted token]'
    );
}

const INSPECTION_ATTRIBUTES = new Set([
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'aria-disabled',
  'aria-selected',
  'aria-current',
  'aria-expanded',
  'aria-live',
  'aria-hidden',
  'disabled',
  'hidden',
  'inert',
  'type',
  'alt',
  'data-testid',
  'data-piece',
  'data-piece-square',
  'data-square',
  'data-fen',
  'data-game-id',
  'data-can-move',
  'data-revision',
  'data-outcome',
]);

/**
 * Attributes a watched screen never carries: anything that runs, navigates,
 * loads from elsewhere or holds what a person typed.
 */
function screenAttributeKept(name: string, value: string): boolean {
  if (name.startsWith('on')) return false;
  if (
    [
      'value',
      'srcdoc',
      'href',
      'xlink:href',
      'action',
      'formaction',
      'srcset',
      'autofocus',
      'contenteditable',
    ].includes(name)
  )
    return false;
  if (name === 'src') return value.startsWith('data:image/');
  if (name === 'style') return !/url\s*\(/i.test(value);
  return true;
}

/**
 * What a sanitized capture is for: `inspection` keeps the accessible
 * structure an operator diagnoses with; `screen` also keeps the classes and
 * data attributes the screen is drawn with, so it can be shown as it looks.
 */
export type SanitizeMode = 'inspection' | 'screen';

function stripSensitive(root: HTMLElement): void {
  for (const node of root.querySelectorAll(
    'script, style, link, meta, noscript, iframe, object, embed, template, [data-sensitive], input[type="hidden"], input[type="password"]'
  ))
    node.remove();
}

function sanitizeAttributes(
  root: HTMLElement,
  mode: SanitizeMode,
  redact: (text: string) => string
): void {
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.matches('input, textarea')) {
      element.textContent = '';
      element.setAttribute('value', '');
    }
    for (const attribute of Array.from(element.attributes)) {
      const kept =
        mode === 'screen'
          ? screenAttributeKept(attribute.name, attribute.value)
          : INSPECTION_ATTRIBUTES.has(attribute.name);
      if (!kept) element.removeAttribute(attribute.name);
      else if (attribute.name !== 'class' && attribute.name !== 'style')
        element.setAttribute(
          attribute.name,
          redact(attribute.value).slice(0, mode === 'screen' ? 4096 : 256)
        );
    }
  }
}

/**
 * Work is performed only for an explicit inspection request, or while the
 * app is watched live. Nothing a person typed, nothing marked
 * `data-sensitive` and no email address survives either mode. `source` is
 * the whole document, or the one element an app draws itself in when it
 * shares the document with others.
 */
export function sanitizeDomSnapshot(
  source: Document | Element,
  secrets: readonly string[] = [],
  mode: SanitizeMode = 'inspection'
) {
  const document = 'documentElement' in source ? source : source.ownerDocument;
  const redact = (text: string) => redactDiagnostic(text, secrets);
  const scope: ParentNode = 'documentElement' in source ? document : source;
  const sensitive = new Set(
    [...scope.querySelectorAll('[data-testid]')]
      .filter((element) => element.closest('[data-sensitive]') !== null)
      .map((element) => element.getAttribute('data-testid'))
  );
  const inventory = readDomInventory(document);
  const controls = [...inventory.pressables, ...inventory.inputs]
    .filter((item) => !sensitive.has(item.testId))
    .map((item) => ({
      testId: redact(item.testId),
      role: item.role ?? '',
      name: redact(item.accessibleName || item.text || '').slice(0, 256),
    }));
  const element =
    'documentElement' in source
      ? mode === 'screen'
        ? document.body
        : document.documentElement
      : source;
  const root = element.cloneNode(true) as HTMLElement;
  stripSensitive(root);
  sanitizeAttributes(root, mode, redact);
  // Text nodes are sanitized after attribute filtering; no input values survive.
  const visit = (node: Node): void => {
    if (node.nodeType === 3) node.textContent = redact(node.textContent ?? '');
    for (const child of Array.from(node.childNodes)) visit(child);
  };
  visit(root);
  const limit = mode === 'screen' ? 400_000 : 200_000;
  const html =
    mode === 'screen' && root.tagName !== 'BODY'
      ? `<body>${root.outerHTML}</body>`
      : root.outerHTML;
  return {
    html: html.slice(0, limit),
    controls: controls.slice(0, 200),
  };
}
