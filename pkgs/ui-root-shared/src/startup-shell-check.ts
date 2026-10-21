/**
 * What an app's static boot screen (`index.html`) must hold to: it paints
 * before any stylesheet or script, so its colors are written out, but every
 * one of them is a design-token value, and its loading indicator is the
 * design system's activity indicator, byte for byte.
 *
 * Pure over the page text; each app's `tests/startup-shell.test.ts` runs it.
 */

import { activityIndicatorSvg } from './activity-indicator';
import { COLOR_PALETTE } from './color-palette';

/** The indicator's edge on the boot screen (`Spinner size="lg"`). */
export const STARTUP_INDICATOR_PX = 40;

const COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|color-mix)\([^)]*\)/g;

function tokenValues(): ReadonlySet<string> {
  return new Set([
    ...Object.values(COLOR_PALETTE.light),
    ...Object.values(COLOR_PALETTE.dark),
  ]);
}

/** Every way `html` departs from the boot-screen contract. */
export function startupShellIssues(html: string): readonly string[] {
  const issues: string[] = [];
  if (!html.includes(activityIndicatorSvg(STARTUP_INDICATOR_PX))) {
    issues.push(
      `the boot indicator is not activityIndicatorSvg(${STARTUP_INDICATOR_PX})`
    );
  }
  const allowed = tokenValues();
  for (const match of html.matchAll(COLOR)) {
    if (!allowed.has(match[0])) {
      issues.push(`${match[0]} is not a design-token color`);
    }
  }
  return issues;
}
