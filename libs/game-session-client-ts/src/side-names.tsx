import { t } from '@lingui/core/macro';

/** Several sides' names as one phrase: `South and North`, `South, West and East`. */
export function sideNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const head = names.slice(0, -1).join(', ');
  const last = names.at(-1)!;
  return t`${head} and ${last}`;
}
