import { expect, test } from 'bun:test';
import { temporalStep } from '@pkgs/quint-server-ts/temporal-step';

const model = (
  bindings: string,
  alternatives: string,
  globals = ''
) => `module sample {
  ${globals}
  var count: int
  action step = { ${bindings} any { ${alternatives} } }
}`;

test('each alternative keeps only its own nonempty draws', () => {
  // regression: tlc-rechecks-growing-prefixes
  const step = temporalStep(
    model(
      'nondet actor = PEOPLE.oneOf(); nondet wait = Set(1, 2, 4).oneOf();',
      "count' = actor, count' = wait, count' = 0",
      'pure val PEOPLE = Set(1, 2, 3)'
    ),
    'sample'
  )!;
  expect(step.match(/nondet actor/g)).toHaveLength(1);
  expect(step.match(/nondet wait/g)).toHaveLength(1);
  expect(step).toContain('assign(count, 0)');
});

test('empty, unknown and shadowed domains cannot be discarded', () => {
  for (const [bindings, globals] of [
    ['nondet x = Set().oneOf();', ''],
    ['nondet x = DOMAIN.oneOf();', 'const DOMAIN: Set[int]'],
    [
      'val DOMAIN = Set(); nondet x = DOMAIN.oneOf();',
      'pure val DOMAIN = Set(1)',
    ],
  ]) {
    const step = temporalStep(
      model(bindings!, "count' = 0", globals),
      'sample'
    )!;
    expect(step).toContain('nondet x');
  }
});

test('dependencies between draws stay in scope', () => {
  const step = temporalStep(
    model(
      'nondet x = Set(1, 2).oneOf(); nondet y = Set(x).oneOf();',
      "count' = y"
    ),
    'sample'
  )!;
  expect(step).toContain('nondet x');
  expect(step).toContain('nondet y');
});

test('unrecognized or invalid steps keep the original compiler path', () => {
  expect(temporalStep('not a module', 'sample')).toBeUndefined();
  expect(
    temporalStep('module sample { action step = true }', 'sample')
  ).toBeUndefined();
});
