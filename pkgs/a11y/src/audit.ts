/**
 * Run the ACT rules over a subtree: every applicable element is checked
 * against every rule, and the failures come back in tree order.
 */

import type { ActFailure, ActRule } from './act-rule';
import {
  ariaHiddenNotFocusable,
  requiredContext,
  requiredOwned,
  requiredStates,
  validRole,
} from './aria-rules';
import { describeControl } from './controls';
import { treeOrder } from './focus';
import {
  buttonName,
  formFieldName,
  imageName,
  labelInName,
  linkName,
  menuitemName,
} from './name-rules';

/** Every rule this package checks, by ACT id. */
export const ACT_RULES: readonly ActRule[] = [
  buttonName,
  linkName,
  formFieldName,
  menuitemName,
  imageName,
  labelInName,
  validRole,
  requiredOwned,
  requiredContext,
  requiredStates,
  ariaHiddenNotFocusable,
];

/** The failures of `rules` (default {@link ACT_RULES}) in `root`, itself included. */
export function auditTree(
  root: Element,
  rules: readonly ActRule[] = ACT_RULES
): ActFailure[] {
  const failures: ActFailure[] = [];
  for (const element of treeOrder(root)) {
    for (const rule of rules) {
      if (!rule.applicable(element) || rule.passes(element)) continue;
      failures.push({
        rule: rule.id,
        title: rule.title,
        wcag: rule.wcag,
        target: describeControl(element),
      });
    }
  }
  return failures;
}

/** One line per failure: `97a4e1 Button has non-empty accessible name: button ""`. */
export function formatFailure(failure: ActFailure): string {
  return `${failure.rule} ${failure.title} (WCAG ${failure.wcag.join(', ')}): ${failure.target}`;
}
