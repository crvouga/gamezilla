import { describe, expect, test } from 'bun:test';

import { modelShapeProblems } from './model-shape';

describe('model shape', () => {
  test('every aggregate handles a lost connection and can be checked', () => {
    expect(modelShapeProblems()).toEqual([]);
  });
});
