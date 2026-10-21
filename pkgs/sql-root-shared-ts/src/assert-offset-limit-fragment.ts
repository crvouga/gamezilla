import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * LIMIT/OFFSET fragments are appended to queries with `?` parameter placeholders.
 * Valid forms: `""`, `" LIMIT ?"`, `" OFFSET ?"`, `" LIMIT ? OFFSET ?"`.
 */
export function assertOffsetLimitFragment(
  fragment: string
): asserts fragment is string {
  assert.ok(typeof fragment === 'string', 'LIMIT/OFFSET: not a string', {
    fragment,
  });

  const trimmed = fragment.trim();
  if (trimmed.length === 0) return;

  assert.ok(
    /^(LIMIT \?( OFFSET \?)?)|(OFFSET \?)$/i.test(trimmed),
    'LIMIT/OFFSET: must match "LIMIT ?", "OFFSET ?", or "LIMIT ? OFFSET ?"',
    { fragment }
  );

  assert.ok(!trimmed.includes(';'), 'LIMIT/OFFSET: semicolons forbidden', {
    fragment,
  });

  assert.ok(
    !trimmed.includes('--') && !trimmed.includes('/*'),
    'LIMIT/OFFSET: comments forbidden',
    { fragment }
  );
}
