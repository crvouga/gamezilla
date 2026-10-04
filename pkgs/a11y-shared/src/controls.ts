/**
 * The controls on a screen — everything a person can act on — and the stops a
 * keyboard should make among them, in reading (tree) order.
 */

import { accessibleName } from './accessible-name';
import {
  isDisabled,
  isNativelyFocusable,
  parseTabIndex,
  sequentialFocusOrder,
  treeOrder,
} from './focus';
import {
  COMPOSITE_ROLES,
  CONTROL_ROLES,
  explicitRoleOf,
  roleOf,
  tagOf,
} from './roles';
import { isInert, isRendered } from './visibility';

function interactive(element: Element): boolean {
  if (isNativelyFocusable(element)) return tagOf(element) !== 'iframe';
  const role = explicitRoleOf(element);
  if (role !== null && CONTROL_ROLES.has(role)) return true;
  return (parseTabIndex(element.getAttribute('tabindex')) ?? -1) >= 0;
}

/**
 * Every control shown in `root`, in tree order: native interactive elements,
 * elements with an operable widget role, and anything with `tabindex ≥ 0`;
 * rendered and not inert. Disabled controls are shown but not operable, and
 * are left out.
 */
export function controlsIn(root: Element): Element[] {
  return treeOrder(root).filter(
    (element) =>
      interactive(element) &&
      !isDisabled(element) &&
      !isInert(element) &&
      isRendered(element)
  );
}

function compositeOf(element: Element): Element | null {
  let current = element.parentElement;
  while (current !== null) {
    const role = explicitRoleOf(current);
    if (role !== null && COMPOSITE_ROLES.has(role)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * A member a composite widget reaches with arrow keys instead of Tab: it has
 * `tabindex="-1"` inside a composite that has a Tab stop of its own (a
 * member, or itself with `aria-activedescendant`).
 */
function rovingMember(element: Element, stops: ReadonlySet<Element>): boolean {
  if ((parseTabIndex(element.getAttribute('tabindex')) ?? 0) >= 0) return false;
  const composite = compositeOf(element);
  if (composite === null) return false;
  if (stops.has(composite)) return true;
  for (const stop of stops) {
    if (composite.contains(stop)) return true;
  }
  return false;
}

function groupedRadio(element: Element, stops: ReadonlySet<Element>): boolean {
  const radio =
    tagOf(element) === 'input' && element.getAttribute('type') === 'radio';
  return radio && element.hasAttribute('name') && !stops.has(element);
}

/**
 * Where a keyboard should stop in `root`, in reading order: every control
 * except a composite's arrow-key members and the non-selected radios of a
 * group (each group is one stop).
 */
export function keyboardStops(root: Element): Element[] {
  const stops = new Set(sequentialFocusOrder(root));
  return controlsIn(root).filter(
    (element) => !rovingMember(element, stops) && !groupedRadio(element, stops)
  );
}

/** How a listener hears a control: its role and its name (`button "Close"`). */
export function describeControl(element: Element): string {
  const role = roleOf(element) ?? tagOf(element);
  return `${role} "${accessibleName(element)}"`;
}
