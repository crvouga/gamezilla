import {
  ACTIVITY_PETALS,
  ACTIVITY_REVOLUTION_MS,
  activityIndicatorSvg,
} from './activity-indicator';
import { COLOR_PALETTE } from './color-palette';

const COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|color-mix)\([^)]*\)/g;

/** The product opens on navigation. The separate developer console uses an indicator. */
export function startupShellIssues(
  html: string,
  surface: 'product' | 'harness'
): readonly string[] {
  const issues: string[] = [];
  if (surface === 'product') {
    if (!/<nav\b[^>]*>[\s\S]*?<a\b[^>]*href=/i.test(html)) {
      issues.push('the opening document has no navigation');
    }
    if (/activity-indicator|role="progressbar"|aria-busy="true"/.test(html)) {
      issues.push('the opening document shows a loading indicator');
    }
  } else {
    const step = `${ACTIVITY_REVOLUTION_MS}ms steps(${ACTIVITY_PETALS}, end)`;
    if (!html.includes(activityIndicatorSvg(40)) || !html.includes(step)) {
      issues.push(
        'the harness opening indicator differs from the design system'
      );
    }
  }
  const allowed = new Set([
    ...Object.values(COLOR_PALETTE.light),
    ...Object.values(COLOR_PALETTE.dark),
  ]);
  for (const match of html.matchAll(COLOR)) {
    if (!allowed.has(match[0])) {
      issues.push(`${match[0]} is not a design-token color`);
    }
  }
  return issues;
}
