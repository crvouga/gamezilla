/**
 * The accessible name of an element: what a screen reader says it is.
 * W3C Accessible Name and Description Computation 1.2 § 4.3.2, steps 2A–2I,
 * with the HTML-AAM native sources (label, `alt`, `value`, legend, caption,
 * figcaption, SVG `<title>`, `title`, `placeholder`). CSS generated content
 * is not read (no layout engine).
 */

import { isBlock } from './blocks';
import { NAME_FROM_CONTENT_ROLES, roleOf, tagOf } from './roles';
import { isHiddenFromAt } from './visibility';

type Walk = {
  /** The element whose name is being computed. */
  readonly root: Element;
  /** Inside an `aria-labelledby` traversal: its references are not followed again. */
  readonly inLabelledBy: boolean;
  /** The traversal started at a hidden referenced node: hidden nodes count. */
  readonly includeHidden: boolean;
  /** Below the root (name from content, a label, or a reference). */
  readonly recursing: boolean;
};

/** Collapse whitespace runs and trim, as every name is presented. */
export function normalizeName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function nonEmpty(text: string | null | undefined): text is string {
  return text !== null && text !== undefined && text.trim().length > 0;
}

function byId(element: Element, id: string): Element | null {
  return element.ownerDocument.getElementById(id);
}

function labelledBy(node: Element, walk: Walk): string | null {
  const ids = node.getAttribute('aria-labelledby')?.trim() ?? '';
  if (ids.length === 0) return null;
  const parts: string[] = [];
  for (const id of ids.split(/\s+/)) {
    const ref = byId(node, id);
    if (ref === null) continue;
    const hidden = walk.includeHidden || isHiddenFromAt(ref);
    parts.push(
      nameOf(ref, {
        root: walk.root,
        inLabelledBy: true,
        includeHidden: hidden,
        recursing: true,
      })
    );
  }
  const joined = parts.join(' ');
  return nonEmpty(joined) ? joined : null;
}

const RANGE_ROLES = new Set([
  'meter',
  'progressbar',
  'scrollbar',
  'slider',
  'spinbutton',
]);

function fieldValue(node: Element): string {
  const value = (node as Partial<HTMLInputElement>).value;
  return typeof value === 'string' ? value : (node.textContent ?? '');
}

function selectedText(node: Element): string {
  const options = Array.from(
    node.querySelectorAll('option, [role="option"]')
  ).filter(
    (option) =>
      (option as Partial<HTMLOptionElement>).selected === true ||
      option.getAttribute('aria-selected') === 'true'
  );
  return options.map((option) => option.textContent ?? '').join(' ');
}

/** 2C: a control embedded in another widget's label speaks its value. */
function embeddedValue(node: Element): string | null {
  const role = roleOf(node);
  if (role === 'textbox' || role === 'searchbox') return fieldValue(node);
  if (role === 'combobox' || role === 'listbox') {
    return tagOf(node) === 'input' ? fieldValue(node) : selectedText(node);
  }
  if (role !== null && RANGE_ROLES.has(role)) {
    return (
      node.getAttribute('aria-valuetext') ??
      node.getAttribute('aria-valuenow') ??
      fieldValue(node)
    );
  }
  return null;
}

function labelsOf(control: Element): Element[] {
  const labels: Element[] = [];
  const id = control.getAttribute('id');
  if (id !== null && id.length > 0) {
    for (const label of control.ownerDocument.querySelectorAll('label')) {
      if (label.getAttribute('for') === id) labels.push(label);
    }
  }
  const wrapping = control.parentElement?.closest('label') ?? null;
  const wrapFor = wrapping?.getAttribute('for') ?? null;
  if (wrapping !== null && !labels.includes(wrapping)) {
    if (wrapFor === null || wrapFor === id) labels.push(wrapping);
  }
  return labels;
}

const LABELABLE = new Set([
  'button',
  'input',
  'meter',
  'output',
  'progress',
  'select',
  'textarea',
]);

function fromLabels(node: Element, walk: Walk): string | null {
  if (!LABELABLE.has(tagOf(node))) return null;
  const parts = labelsOf(node).map((label) =>
    contentName(label, { ...walk, recursing: true })
  );
  const joined = parts.join(' ');
  return nonEmpty(joined) ? joined : null;
}

const INPUT_BUTTON_DEFAULTS: Readonly<Record<string, string>> = {
  submit: 'Submit',
  reset: 'Reset',
};

function inputButtonName(node: Element): string | null {
  const type = (node.getAttribute('type') ?? '').toLowerCase();
  if (type === 'image') {
    return node.getAttribute('alt') ?? node.getAttribute('value');
  }
  if (type !== 'button' && type !== 'submit' && type !== 'reset') return null;
  const value = node.getAttribute('value');
  return value ?? INPUT_BUTTON_DEFAULTS[type] ?? null;
}

function childText(node: Element, tag: string): string | null {
  for (const child of node.children) {
    if (tagOf(child) === tag) return child.textContent;
  }
  return null;
}

const CHILD_CAPTIONS: Readonly<Record<string, string>> = {
  fieldset: 'legend',
  figure: 'figcaption',
  svg: 'title',
  table: 'caption',
};

/** 2E: the host language's own label for the element. */
function nativeName(node: Element, walk: Walk): string | null {
  const tag = tagOf(node);
  if (tag === 'input') {
    const button = inputButtonName(node);
    if (nonEmpty(button)) return button;
  }
  const labelled = fromLabels(node, walk);
  if (labelled !== null) return labelled;
  if (tag === 'img' || tag === 'area') return node.getAttribute('alt');
  const captionTag = CHILD_CAPTIONS[tag];
  if (captionTag === undefined) return null;
  const caption = childText(node, captionTag);
  return nonEmpty(caption) ? caption : null;
}

/** 2F: the text of the node's children, each named in turn. */
function contentName(node: Element, walk: Walk): string {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === child.TEXT_NODE) {
      out += child.textContent ?? '';
      continue;
    }
    if (child.nodeType !== child.ELEMENT_NODE) continue;
    const element = child as Element;
    if (element === walk.root) continue;
    const part = nameOf(element, { ...walk, recursing: true });
    out += isBlock(element) ? ` ${part} ` : part;
  }
  return out;
}

/** 2I: the tooltip attribute, then an input's placeholder. */
function tooltip(node: Element): string {
  for (const name of ['title', 'placeholder', 'aria-placeholder']) {
    const value = node.getAttribute(name);
    if (nonEmpty(value)) return value;
  }
  return '';
}

function allowsContent(node: Element, walk: Walk): boolean {
  if (walk.recursing) return true;
  const role = roleOf(node);
  return role !== null && NAME_FROM_CONTENT_ROLES.has(role);
}

function nameOf(node: Element, walk: Walk): string {
  if (!walk.includeHidden && isHiddenFromAt(node)) return '';
  if (!walk.inLabelledBy) {
    const referenced = labelledBy(node, walk);
    if (referenced !== null) return referenced;
  }
  if (walk.recursing && node !== walk.root) {
    const value = embeddedValue(node);
    if (value !== null) return value;
  }
  const label = node.getAttribute('aria-label');
  if (nonEmpty(label)) return label;
  const native = nativeName(node, walk);
  if (native !== null && (nonEmpty(native) || tagOf(node) === 'img')) {
    return native;
  }
  if (allowsContent(node, walk)) {
    const content = contentName(node, walk);
    if (nonEmpty(content)) return content;
  }
  return tooltip(node);
}

/** The element's accessible name, whitespace-normalized; `''` when it has none. */
export function accessibleName(element: Element): string {
  return normalizeName(
    nameOf(element, {
      root: element,
      inLabelledBy: false,
      includeHidden: false,
      recursing: false,
    })
  );
}
