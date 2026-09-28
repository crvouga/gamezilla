/**
 * ACT rules about what a listener hears an element called: every button,
 * link, form field, menu item and meaningful image has a name, and a control
 * whose label is shown says that label.
 */

import { accessibleName, normalizeName } from './accessible-name';
import type { ActRule } from './act-rule';
import { isBlock } from './blocks';
import { NAME_FROM_CONTENT_ROLES, roleOf, tagOf } from './roles';
import { isHiddenFromAt, isRendered } from './visibility';

function exposedWithRole(roles: ReadonlySet<string>) {
  return (element: Element): boolean => {
    const role = roleOf(element);
    return role !== null && roles.has(role) && !isHiddenFromAt(element);
  };
}

function hasName(element: Element): boolean {
  return accessibleName(element).length > 0;
}

const imageButton = (element: Element): boolean =>
  tagOf(element) === 'input' && element.getAttribute('type') === 'image';

/** ACT 97a4e1 — Button has non-empty accessible name. */
export const buttonName: ActRule = {
  id: '97a4e1',
  title: 'Button has non-empty accessible name',
  wcag: ['4.1.2'],
  applicable: (element) =>
    exposedWithRole(new Set(['button']))(element) && !imageButton(element),
  passes: hasName,
};

/** ACT c487ae — Link has non-empty accessible name. */
export const linkName: ActRule = {
  id: 'c487ae',
  title: 'Link has non-empty accessible name',
  wcag: ['2.4.4', '2.4.9', '4.1.2'],
  applicable: exposedWithRole(new Set(['link'])),
  passes: hasName,
};

const FORM_FIELD_ROLES = new Set([
  'checkbox',
  'combobox',
  'listbox',
  'menuitemcheckbox',
  'menuitemradio',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'textbox',
]);

/** ACT e086e5 — Form field has non-empty accessible name. */
export const formFieldName: ActRule = {
  id: 'e086e5',
  title: 'Form field has non-empty accessible name',
  wcag: ['4.1.2'],
  applicable: exposedWithRole(FORM_FIELD_ROLES),
  passes: hasName,
};

/** ACT m6b1q3 — Menuitem has non-empty accessible name. */
export const menuitemName: ActRule = {
  id: 'm6b1q3',
  title: 'Menuitem has non-empty accessible name',
  wcag: ['4.1.2'],
  applicable: exposedWithRole(new Set(['menuitem'])),
  passes: hasName,
};

/**
 * ACT 23a2a8 — Image has non-empty accessible name. A decorative image
 * (`alt=""`, `role="none"`) has no `img` role and is not applicable.
 */
export const imageName: ActRule = {
  id: '23a2a8',
  title: 'Image has non-empty accessible name',
  wcag: ['1.1.1'],
  applicable: exposedWithRole(new Set(['img'])),
  passes: hasName,
};

/** Text of the rendered text nodes under `element` (what a sighted person reads). */
export function visibleText(element: Element): string {
  let out = '';
  for (const child of element.childNodes) {
    if (child.nodeType === child.TEXT_NODE) {
      out += child.textContent ?? '';
    } else if (child.nodeType === child.ELEMENT_NODE) {
      const inner = child as Element;
      if (!isRendered(inner)) continue;
      out += isBlock(inner) ? ` ${visibleText(inner)} ` : visibleText(inner);
    }
  }
  return out;
}

/** Case, punctuation and spacing do not change what a label says. */
function comparable(text: string): string {
  return normalizeName(text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' '));
}

const WIDGET_ROLES_FROM_CONTENT = new Set(
  [...NAME_FROM_CONTENT_ROLES].filter(
    (role) =>
      ![
        'cell',
        'columnheader',
        'heading',
        'row',
        'rowheader',
        'tooltip',
      ].includes(role)
  )
);

/**
 * ACT 2ee8b8 — Visible label is part of accessible name (WCAG 2.5.3 Label in
 * Name): a widget that shows its label in its own text says it, so a person
 * who speaks the visible label can name it.
 */
export const labelInName: ActRule = {
  id: '2ee8b8',
  title: 'Visible label is part of accessible name',
  wcag: ['2.5.3'],
  applicable: (element) =>
    exposedWithRole(WIDGET_ROLES_FROM_CONTENT)(element) &&
    comparable(visibleText(element)).length > 0,
  passes: (element) =>
    comparable(accessibleName(element)).includes(
      comparable(visibleText(element))
    ),
};
