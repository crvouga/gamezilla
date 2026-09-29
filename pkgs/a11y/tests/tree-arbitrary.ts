/**
 * Random pages for the properties: a tree of elements, each with a tag, a
 * `tabindex`, maybe `disabled`, and maybe a way of being hidden. Rendered to
 * HTML with ids `n0…`, and modelled independently of the DOM.
 */

import { fc } from '@pkgs/property';

export const TAGS = [
  'div',
  'span',
  'button',
  'a',
  'a-href',
  'input-text',
  'input-checkbox',
  'input-hidden',
  'textarea',
  'select',
] as const;

export type Tag = (typeof TAGS)[number];

export const HIDES = ['shown', 'hidden', 'display', 'inert', 'aria'] as const;

export type Hide = (typeof HIDES)[number];

export type NodeSpec = {
  readonly tag: Tag;
  readonly tabindex: string | null;
  readonly disabled: boolean;
  readonly hide: Hide;
  readonly children: readonly NodeSpec[];
};

const { tree } = fc.letrec<{ tree: NodeSpec }>((tie) => ({
  tree: fc.record({
    tag: fc.constantFrom(...TAGS),
    tabindex: fc.constantFrom(null, null, null, '-1', '0', '1', '2', '3', 'x'),
    disabled: fc.boolean(),
    hide: fc.constantFrom<Hide>('shown', 'shown', 'shown', 'shown', ...HIDES),
    children: fc.oneof(
      { maxDepth: 3, depthIdentifier: 'tree' },
      fc.constant<readonly NodeSpec[]>([]),
      fc.array(tie('tree'), { maxLength: 3 })
    ),
  }),
}));

const VOID_OR_LEAF = new Set<Tag>([
  'input-text',
  'input-checkbox',
  'input-hidden',
  'textarea',
  'select',
]);

/** Form controls hold no element children. */
function prune(node: NodeSpec): NodeSpec {
  return {
    ...node,
    children: VOID_OR_LEAF.has(node.tag) ? [] : node.children.map(prune),
  };
}

export const arbPage = fc
  .array(tree, { minLength: 1, maxLength: 5 })
  .map((nodes) => nodes.map(prune));

function open(tag: Tag): { readonly name: string; readonly type?: string } {
  if (tag === 'a-href') return { name: 'a' };
  if (tag.startsWith('input-')) {
    return { name: 'input', type: tag.slice('input-'.length) };
  }
  return { name: tag };
}

function attributes(node: NodeSpec, id: string): [string, string][] {
  const out: [string, string][] = [['id', id]];
  const { type } = open(node.tag);
  if (type !== undefined) out.push(['type', type]);
  if (node.tag === 'a-href') out.push(['href', '#']);
  if (node.tabindex !== null) out.push(['tabindex', node.tabindex]);
  if (node.disabled) out.push(['disabled', '']);
  if (node.hide === 'hidden') out.push(['hidden', '']);
  if (node.hide === 'display') out.push(['style', 'display:none']);
  if (node.hide === 'inert') out.push(['inert', '']);
  if (node.hide === 'aria') out.push(['aria-hidden', 'true']);
  return out;
}

/** Pre-order: `visit` sees each node with its id and what its parent returned. */
export function walk<C>(
  nodes: readonly NodeSpec[],
  context: C,
  visit: (node: NodeSpec, id: string, context: C) => C
): void {
  let next = 0;
  const go = (list: readonly NodeSpec[], ctx: C): void => {
    for (const node of list) {
      const inner = visit(node, `n${String(next++)}`, ctx);
      go(node.children, inner);
    }
  };
  go(nodes, context);
}

/**
 * The page built element by element (ids in pre-order), so the tree is
 * exactly the description: no HTML parser re-parents nested links or buttons.
 */
export function build(document: Document, nodes: readonly NodeSpec[]): void {
  walk<Element>(nodes, document.body, (node, id, parent) => {
    const element = document.createElement(open(node.tag).name);
    for (const [name, value] of attributes(node, id)) {
      element.setAttribute(name, value);
    }
    parent.appendChild(element);
    return element;
  });
}
