/**
 * @pkgs/a11y — accessibility checks over a live DOM, with no layout engine:
 * the accessible name computation, ARIA roles, the sequential focus order,
 * the controls on a screen, and a set of W3C ACT rules.
 */

export { accessibleName, normalizeName } from './accessible-name';
export type { ActFailure, ActRule } from './act-rule';
export {
  ariaHiddenNotFocusable,
  requiredContext,
  requiredOwned,
  requiredStates,
  validRole,
} from './aria-rules';
export { ACT_RULES, auditTree, formatFailure } from './audit';
export { controlsIn, describeControl, keyboardStops } from './controls';
export {
  isDisabled,
  isFocusable,
  isNativelyFocusable,
  isSequentiallyFocusable,
  nextInFocusOrder,
  parseTabIndex,
  sequentialFocusOrder,
  tabIndexOf,
  treeOrder,
} from './focus';
export {
  buttonName,
  formFieldName,
  imageName,
  labelInName,
  linkName,
  menuitemName,
  visibleText,
} from './name-rules';
export { explicitRoleOf, implicitRoleOf, roleOf } from './roles';
export {
  isAriaHidden,
  isHiddenFromAt,
  isInert,
  isRendered,
} from './visibility';
