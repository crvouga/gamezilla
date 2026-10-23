import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * ORDER BY fragments are interpolated directly into SQL (not parameterized),
 * so we validate them thoroughly to catch programming errors early.
 *
 * An empty string is allowed and passes validation with no checks.
 */
export function assertOrderByFragment(
  fragment: string
): asserts fragment is string {
  assert.ok(typeof fragment === 'string', 'ORDER BY: not a string', {
    fragment,
  });

  const trimmed = fragment.trim();

  if (trimmed.length === 0) {
    return;
  }

  assert.ok(
    /^ORDER BY\b/i.test(trimmed),
    'ORDER BY: must start with ORDER BY',
    { fragment }
  );

  const body = trimmed.slice('ORDER BY'.length);

  assert.ok(
    body.trim().length > 0,
    'ORDER BY: must specify at least one column',
    { fragment }
  );

  assert.ok(
    !body.includes(';'),
    'ORDER BY: semicolons forbidden (statement boundary)',
    { fragment }
  );

  assert.ok(!body.includes('--'), 'ORDER BY: line comments forbidden', {
    fragment,
  });

  assert.ok(!body.includes('/*'), 'ORDER BY: block comments forbidden', {
    fragment,
  });

  assert.ok(
    !body.includes('?'),
    'ORDER BY: parameter placeholders forbidden (fragment is interpolated, not parameterized)',
    { fragment }
  );

  const FORBIDDEN_KEYWORDS =
    /\b(UNION|INTERSECT|EXCEPT|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|VACUUM|EXPLAIN|INTO|FROM|WHERE|HAVING|GROUP|LIMIT|OFFSET|SET|VALUES)\b/i;
  assert.ok(
    !FORBIDDEN_KEYWORDS.test(body),
    'ORDER BY: contains forbidden SQL keyword',
    { fragment, matched: body.match(FORBIDDEN_KEYWORDS)?.[0] }
  );

  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    assert.ok(
      depth >= 0,
      'ORDER BY: unbalanced parentheses (extra closing paren)',
      { fragment, position: i }
    );
  }
  assert.ok(
    depth === 0,
    'ORDER BY: unbalanced parentheses (unclosed open paren)',
    { fragment, unclosed: depth }
  );
}
