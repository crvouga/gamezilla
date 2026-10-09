import { readDomInventory } from '@pkgs/ui-testing-root-shared/dom-inventory';
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

export function redactDiagnostic(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
    .replace(/Bearer\s+\S+/gi, '[redacted token]')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[redacted token]'
    );
}

/** Work is performed only for an explicit inspection request on the live instance. */
export function sanitizeDomSnapshot(
  document: Document,
  secrets: readonly string[] = []
) {
  const redact = (text: string) =>
    secrets
      .filter(Boolean)
      .reduce(
        (value, secret) => value.replaceAll(secret, '[redacted credential]'),
        redactDiagnostic(text)
      );
  const controls = readDomInventory(document).pressables.map((item) => ({
    testId: item.testId,
    role: item.role ?? '',
    name: redact(item.accessibleName || item.text || '').slice(0, 256),
  }));
  const root = document.documentElement.cloneNode(true) as HTMLElement;
  for (const node of root.querySelectorAll(
    'script, style, iframe, object, embed, template, [data-sensitive], input[type="hidden"]'
  ))
    node.remove();
  const allowed = new Set([
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
    'type',
    'alt',
    'data-testid',
    'data-piece',
    'data-piece-square',
    'data-square',
  ]);
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.matches('input, textarea')) {
      element.textContent = '';
      element.setAttribute('value', '');
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!allowed.has(attribute.name)) element.removeAttribute(attribute.name);
      else
        element.setAttribute(
          attribute.name,
          redact(attribute.value).slice(0, 256)
        );
    }
  }
  // Text nodes are sanitized after attribute filtering; no input values survive.
  const visit = (node: Node): void => {
    if (node.nodeType === 3) node.textContent = redact(node.textContent ?? '');
    for (const child of Array.from(node.childNodes)) visit(child);
  };
  visit(root);
  return {
    html: root.outerHTML.slice(0, 200_000),
    controls: controls.slice(0, 200),
  };
}
