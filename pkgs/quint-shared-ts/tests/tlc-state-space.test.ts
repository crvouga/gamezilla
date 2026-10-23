import { expect, test } from 'bun:test';
import { tlcStateSpace } from '@pkgs/quint-shared-ts/tlc-state-space';

test('only the final graph size is reported as exhaustive state-space evidence', () => {
  // regression: quint-progress-count-as-exhaustive
  const output = `Progress(8): 68,859 states generated, 13,084 distinct states found, 5,158 states left on queue.
Model checking completed. No error has been found.
149437 states generated, 19000 distinct states found, 0 states left on queue.
The depth of the complete state graph search is 10.`;
  expect(tlcStateSpace(output)).toEqual({ states: 19000, depth: 10 });
});

test('progress and an unfinished queue cannot be called a complete graph', () => {
  const output = `Progress(10): 14 states generated, 7 distinct states found, 2 states left on queue.
The depth of the complete state graph search is 10.`;
  expect(tlcStateSpace(output)).toBeNull();
});
