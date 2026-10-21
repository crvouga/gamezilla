/**
 * ACT rules about what a listener hears an element to be: its role is a real
 * one, it sits where its role belongs, it owns what its role needs, it
 * carries the states its role needs, and nothing hidden from them takes the
 * keyboard.
 */

import type { ActRule } from './act-rule';
import { isSequentiallyFocusable, treeOrder } from './focus';
import {
  ARIA_ROLES,
  explicitRoleOf,
  implicitRoleOf,
  isTransparentRole,
  roleOf,
} from './roles';
import { isHiddenFromAt } from './visibility';

/** ACT 674b10 — Role attribute has valid value. */
export const validRole: ActRule = {
  id: '674b10',
  title: 'Role attribute has valid value',
  wcag: ['4.1.2'],
  applicable: (element) =>
    (element.getAttribute('role')?.trim() ?? '').length > 0 &&
    !isHiddenFromAt(element),
  passes: (element) =>
    (element.getAttribute('role') ?? '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .some((token) => ARIA_ROLES.has(token)),
};

const MENU_ITEMS = ['menuitem', 'menuitemcheckbox', 'menuitemradio', 'group'];

const REQUIRED_OWNED: Readonly<Record<string, readonly string[]>> = {
  feed: ['article'],
  grid: ['row', 'rowgroup'],
  list: ['listitem'],
  listbox: ['option', 'group'],
  menu: [...MENU_ITEMS, 'separator'],
  menubar: [...MENU_ITEMS, 'separator'],
  row: ['cell', 'columnheader', 'gridcell', 'rowheader'],
  rowgroup: ['row'],
  table: ['row', 'rowgroup'],
  tablist: ['tab'],
  tree: ['treeitem', 'group'],
  treegrid: ['row', 'rowgroup'],
};

/** Children in the accessibility tree: transparent and hidden nodes pass through. */
function ownedElements(element: Element): Element[] {
  const owned: Element[] = [];
  for (const child of element.children) {
    if (isHiddenFromAt(child)) continue;
    if (isTransparentRole(roleOf(child))) owned.push(...ownedElements(child));
    else owned.push(child);
  }
  return owned;
}

/** ACT bc4a75 — ARIA required owned elements. */
export const requiredOwned: ActRule = {
  id: 'bc4a75',
  title: 'ARIA required owned elements',
  wcag: ['1.3.1'],
  applicable: (element) => {
    const role = explicitRoleOf(element);
    return (
      role !== null &&
      REQUIRED_OWNED[role] !== undefined &&
      element.getAttribute('aria-busy') !== 'true' &&
      !isHiddenFromAt(element)
    );
  },
  passes: (element) => {
    const allowed = REQUIRED_OWNED[explicitRoleOf(element) ?? ''] ?? [];
    return ownedElements(element).every((owned) =>
      allowed.includes(roleOf(owned) ?? '')
    );
  },
};

const MENU_CONTEXT = ['menu', 'menubar', 'group'];

const REQUIRED_CONTEXT: Readonly<Record<string, readonly string[]>> = {
  cell: ['row'],
  columnheader: ['row'],
  gridcell: ['row'],
  listitem: ['list', 'directory'],
  menuitem: MENU_CONTEXT,
  menuitemcheckbox: MENU_CONTEXT,
  menuitemradio: MENU_CONTEXT,
  option: ['listbox', 'group'],
  row: ['grid', 'rowgroup', 'table', 'treegrid'],
  rowgroup: ['grid', 'table', 'treegrid'],
  rowheader: ['row'],
  tab: ['tablist'],
  treeitem: ['tree', 'group'],
};

/** The nearest ancestor that is in the accessibility tree with a role of its own. */
function accessibleParent(element: Element): Element | null {
  let current = element.parentElement;
  while (current !== null && isTransparentRole(roleOf(current))) {
    current = current.parentElement;
  }
  return current;
}

/** ACT ff89c9 — ARIA required context role. */
export const requiredContext: ActRule = {
  id: 'ff89c9',
  title: 'ARIA required context role',
  wcag: ['1.3.1'],
  applicable: (element) => {
    const role = explicitRoleOf(element);
    return (
      role !== null &&
      REQUIRED_CONTEXT[role] !== undefined &&
      !isHiddenFromAt(element)
    );
  },
  passes: (element) => {
    const allowed = REQUIRED_CONTEXT[explicitRoleOf(element) ?? ''] ?? [];
    const parent = accessibleParent(element);
    return parent !== null && allowed.includes(roleOf(parent) ?? '');
  },
};

const CHECKED = ['aria-checked'];

const REQUIRED_STATES: Readonly<Record<string, readonly string[]>> = {
  checkbox: CHECKED,
  combobox: ['aria-expanded'],
  heading: ['aria-level'],
  menuitemcheckbox: CHECKED,
  menuitemradio: CHECKED,
  meter: ['aria-valuenow'],
  radio: CHECKED,
  scrollbar: ['aria-controls', 'aria-valuenow'],
  slider: ['aria-valuenow'],
  switch: CHECKED,
};

/** Native state an HTML element already carries for an attribute. */
function nativelyCarries(element: Element, attribute: string): boolean {
  const tag = element.localName.toLowerCase();
  if (attribute === 'aria-checked') {
    const type = element.getAttribute('type');
    return tag === 'input' && (type === 'checkbox' || type === 'radio');
  }
  if (attribute === 'aria-level') return /^h[1-6]$/.test(tag);
  if (attribute === 'aria-valuenow') {
    return tag === 'input' || tag === 'meter' || tag === 'progress';
  }
  return false;
}

/** ACT 4e8ab6 — Element with role attribute has required states and properties. */
export const requiredStates: ActRule = {
  id: '4e8ab6',
  title: 'Element with role attribute has required states and properties',
  wcag: ['4.1.2'],
  applicable: (element) => {
    const role = explicitRoleOf(element);
    return (
      role !== null &&
      REQUIRED_STATES[role] !== undefined &&
      implicitRoleOf(element) !== role &&
      !isHiddenFromAt(element)
    );
  },
  passes: (element) =>
    (REQUIRED_STATES[explicitRoleOf(element) ?? ''] ?? []).every(
      (attribute) =>
        element.hasAttribute(attribute) || nativelyCarries(element, attribute)
    ),
};

/**
 * ACT 6cfa84 — Element with `aria-hidden` has no content in sequential focus
 * navigation: the keyboard never lands where a listener hears nothing.
 */
export const ariaHiddenNotFocusable: ActRule = {
  id: '6cfa84',
  title:
    'Element with aria-hidden has no content in sequential focus navigation',
  wcag: ['1.3.1', '4.1.2'],
  applicable: (element) => element.getAttribute('aria-hidden') === 'true',
  passes: (element) => !treeOrder(element).some(isSequentiallyFocusable),
};
