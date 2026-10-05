/**
 * Tiger Style assertions for the sx-codemod.
 *
 * Every layer of the codemod states its invariants out loud: mapping outputs
 * are well-formed, span edits never overlap, converted tags always carry a
 * class and never leak `sx`, reports add up, and the CLI never writes unless
 * every gate passed. A failing invariant throws (fail-fast) instead of
 * emitting a close-enough conversion — the assertions are a force multiplier
 * for the property suite, turning "looks right" into "provably held".
 */

import { Assert } from '@pkgs/assert-root-shared/assert';

/** Recoverable-failure assert: throws `ValidationError` with codemod context. */
export const tiger: Assert = Assert.validation();

/** Invariant: must hold if this code is correct; throws otherwise. */
export function invariant(
  condition: boolean,
  message: string
): asserts condition {
  tiger.ok(condition, `sx-codemod invariant violated: ${message}`);
}

/** Assert a value is a non-empty string (class names, element names). */
export function nonEmptyString(
  value: unknown,
  what: string
): asserts value is string {
  tiger.nonEmptyString(
    value,
    `sx-codemod invariant violated: ${what} is empty`
  );
}
