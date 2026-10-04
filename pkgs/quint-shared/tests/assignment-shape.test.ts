import { expect, test } from 'bun:test';
import { modelShapeIssues } from '@pkgs/quint-shared/shape';

const model = (value: string) => `module assignment_shape {
  var _unchanged: bool
  action init = _unchanged' = false
  action _settle(delivered: bool, body: str, known: bool): bool = all {
    _unchanged' = ${value},
  }
  action step = any { _settle(true, "milk", false), _settle(true, "refused", false) }
  val invFlagIsBoolean = Set(false, true).contains(_unchanged)
}`;

test('compound Boolean assignment cannot silently remove accepted work from a proof graph', () => {
  // regression: quint-boolean-assignment-pruned-proof-graph
  const issues = modelShapeIssues(
    model('delivered and (body == "refused" or known)'),
    'assignment-shape.qnt'
  );
  expect(
    issues.filter((issue) => issue.code === 'compound-assignment')
  ).toHaveLength(1);
});

test('parenthesized values, nested Boolean arguments and comments remain valid assignments', () => {
  for (const value of [
    '(delivered and (body == "refused" or known))',
    'Set(body == "refused" or known).contains(delivered)',
    'delivered /* and ignored */',
  ]) {
    const issues = modelShapeIssues(model(value), 'assignment-shape.qnt');
    expect(
      issues.filter((issue) => issue.code === 'compound-assignment')
    ).toEqual([]);
  }
});
