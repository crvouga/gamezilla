import { expect, test } from 'bun:test';
import { inductionTargets } from '@pkgs/quint-server-ts/induction-targets';

function targets(expression: string) {
  return inductionTargets({
    source: `module proof {
      var count: int
      val invPositive = count > 0
      val invSmall = count < 10
      val candidate = ${expression}
    }`,
    module: 'proof',
    candidate: 'candidate',
    invariants: ['invPositive', 'invSmall'],
  });
}

test('named conjuncts need no expanded solver implication', () => {
  // regression: quint-induction-redundant-implication
  expect(targets('all { invPositive, all { count != 0, invSmall } }')).toEqual(
    []
  );
  expect(targets('all { invPositive, count != 0 }')).toEqual(['invSmall']);
});

test('disjunctions and conditions cannot discharge safety properties', () => {
  expect(targets('any { invPositive, invSmall }')).toEqual([
    'invPositive',
    'invSmall',
  ]);
  expect(targets('if (count == 0) invPositive else invSmall')).toEqual([
    'invPositive',
    'invSmall',
  ]);
  expect(targets('invPositive implies invSmall')).toEqual([
    'invPositive',
    'invSmall',
  ]);
});

test('comments, strings, shadowed names and unknown definitions prove nothing', () => {
  expect(targets('count > 0 // invSmall\n')).toEqual([
    'invPositive',
    'invSmall',
  ]);
  expect(targets('"invPositive" == "invSmall"')).toEqual([
    'invPositive',
    'invSmall',
  ]);
  expect(targets('{ val invPositive = true\n invPositive }')).toEqual([
    'invPositive',
    'invSmall',
  ]);
  expect(
    inductionTargets({
      source: 'module proof {}',
      module: 'proof',
      candidate: 'missing',
      invariants: ['invPositive'],
    })
  ).toEqual(['invPositive']);
});
