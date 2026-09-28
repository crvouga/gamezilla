import { describe, expect, test } from 'bun:test';
import { MAX_SPEC_PARTS, specPartProblems } from './spec-packages';

const RUNNER = 'bun run ../../libs/harness/scripts/test-spec.ts';

describe('specPartProblems', () => {
  test('a suite split into exactly its parts is clean', () => {
    expect(
      specPartProblems('libs/a', {
        specParts: 2,
        scripts: {
          'test:spec': RUNNER,
          'test:spec:0': `${RUNNER} --part 0/2`,
          'test:spec:1': `${RUNNER} --part 1/2`,
        },
      })
    ).toEqual([]);
  });

  test('a package without test:spec needs no parts', () => {
    expect(
      specPartProblems('libs/a', { scripts: { test: 'bun test' } })
    ).toEqual([]);
  });

  test('a suite without specParts would never gate', () => {
    expect(
      specPartProblems('libs/a', { scripts: { 'test:spec': RUNNER } })
    ).toEqual([
      `libs/a/package.json: specParts must be an integer from 1 to ${String(MAX_SPEC_PARTS)} — bun check runs the suite as test:spec:0 … test:spec:<specParts - 1>`,
    ]);
  });

  test('missing, stray and mis-numbered parts are named', () => {
    expect(
      specPartProblems('libs/a', {
        specParts: 2,
        scripts: {
          'test:spec': RUNNER,
          'test:spec:0': `${RUNNER} --part 0/3`,
          'test:spec:2': `${RUNNER} --part 2/2`,
        },
      })
    ).toEqual([
      `libs/a/package.json: "test:spec:0" must be "${RUNNER} --part 0/2"`,
      'libs/a/package.json: "test:spec:2" is past specParts (2) — delete it',
      `libs/a/package.json: "test:spec:1" is missing — "${RUNNER} --part 1/2"`,
    ]);
  });
});
