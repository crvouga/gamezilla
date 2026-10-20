import { expect, test } from 'bun:test';
import {
  instantiateModel,
  modelParameterCases,
  modelParameterId,
  modelParameterNames,
} from '@pkgs/quint-server/model-parameters';

const SOURCE = `module example {
  // const FAKE: bool
  const B: bool
  const A: bool
  var ready: bool
  action init = ready' = A and B
}
module imported { const A: bool }`;

test('every combination is enumerated in stable order', () => {
  expect(modelParameterNames(SOURCE, 'example')).toEqual(['A', 'B']);
  expect(modelParameterCases(SOURCE, 'example')).toEqual([
    { A: false, B: false },
    { A: false, B: true },
    { A: true, B: false },
    { A: true, B: true },
  ]);
  expect(modelParameterId({ B: false, A: true })).toBe('A=true,B=false');
});

test('closing constants leaves actions, comments and other modules intact', () => {
  expect(instantiateModel(SOURCE, 'example', { A: true, B: false })).toBe(
    SOURCE.replace('  const B: bool', '  pure val B: bool = false').replace(
      '  const A: bool',
      '  pure val A: bool = true'
    )
  );
  expect(modelParameterCases('module empty { val a = 1 }', 'empty')).toEqual([
    {},
  ]);
});

test('missing, unknown and non-boolean inputs fail before a draw can be cached', () => {
  for (const parameters of [{ A: true }, { A: true, B: false, OTHER: true }])
    expect(() => instantiateModel(SOURCE, 'example', parameters)).toThrow(
      'assign exactly'
    );
  const invalid = JSON.parse('{"A":true,"B":"false"}');
  expect(() =>
    Reflect.apply(instantiateModel, undefined, [SOURCE, 'example', invalid])
  ).toThrow('assign exactly');
  expect(() =>
    modelParameterCases('module example { const N: int }', 'example')
  ).toThrow('N must be bool');
});
