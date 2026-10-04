import { expect, test } from 'bun:test';
import { preservationTargets } from '@pkgs/quint/induction-frame';

function targets(body: string, step: string): readonly string[] {
  return preservationTargets({
    source: `module frame { ${body} }`,
    module: 'frame',
    candidate: 'proof',
    step,
  });
}

test('frame reasoning retains a changed property through helper calls and record fields', () => {
  // regression: quint-induction-redundant-state-zero
  expect(
    targets(
      `
    var frozen: int
    var changing: int
    def world = { frozen: frozen, changing: changing }
    action put(w) = all { frozen' = w.frozen, changing' = w.changing }
    val invFrozen = frozen == 0
    val invChanging = changing == 0
    val proof = and { invFrozen, invChanging }
  `,
      'put({ ...world, changing: 1 })'
    )
  ).toEqual(['invChanging']);
});

test.each([
  'any { x\u0027 = x, x\u0027 = 1 }',
  'if (x == 0) x\u0027 = x else true',
])(
  'a branch that changes or omits a variable still needs its property: %s',
  (step) => {
    expect(targets('var x: int val proof = x == 0', step)).toHaveLength(1);
  }
);

test('only an enclosing guard justifies selecting a conditional frame', () => {
  const body =
    'var x: int action maybe = if (x == 0) x\u0027 = x else x\u0027 = 1 val proof = x == 0';
  expect(targets(body, 'all { x == 0, maybe }')).toEqual([]);
  expect(targets(body, 'maybe')).toHaveLength(1);
});

test('a draw never aliases a global variable with the generated binding name', () => {
  expect(
    targets(
      `
    var __frame_bound_0: int
    val proof = __frame_bound_0 == 0
  `,
      '{ nondet chosen = Set(0, 1).oneOf() __frame_bound_0\u0027 = chosen }'
    )
  ).toHaveLength(1);
});

test('unknown imported properties and nondeterministic candidates stay with the solver', () => {
  expect(
    targets('var x: int val proof = foreignProperty', 'x\u0027 = x')
  ).toEqual(['proof']);
  expect(
    targets(
      'var x: int val proof = { nondet value = Set(0, x).oneOf() value == 0 }',
      'x\u0027 = x'
    )
  ).toEqual(['proof']);
});
