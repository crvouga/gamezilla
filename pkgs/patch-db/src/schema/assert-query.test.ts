import { Assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { asKeyword } from '@pkgs/keyword';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { defineEntitySchema } from './entity-schema';
import { createEntitySchemaRegistry } from './entity-schema-registry';
import { assertQueryAgainstSchema } from './assert-query';
import type { PatchDbQuery } from '../interface';

const ns = createAttrNamespace('test');

const PuzzleAttr = {
  id: ns.text('id', (v: unknown) => String(v ?? '')).indexed({ unique: true }),
  rating: ns
    .integer('rating', (v: unknown) => Number(v ?? 0))
    .indexed({ sortable: true }),
  popularity: ns
    .integer('popularity', (v: unknown) => Number(v ?? 0))
    .indexed({ sortable: true }),
  /** Declared but NOT indexed — used to test the "needs-index" failure path. */
  themes: ns.text('themes', (v: unknown) => String(v ?? '')),
} as const;

const PuzzleSchema = defineEntitySchema({
  entityType: 'test.puzzle',
  attributes: PuzzleAttr,
});

const registry = createEntitySchemaRegistry()
  .registerAll([PuzzleSchema])
  .freeze();

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  // Convert the assert package's non-Error throws into standard Errors so
  // Bun's `.toThrow()` actually catches them instead of crashing the test
  // runner.
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});

afterAll(() => {
  disposeTestCrashHandler();
});

describe('assertQueryAgainstSchema', () => {
  test('passes on bare query (no where, no orderBy)', () => {
    expect(() =>
      assertQueryAgainstSchema(
        { entityType: 'test.puzzle' } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('passes on indexed-attribute range filter', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'gte',
            attribute: PuzzleAttr.rating.key,
            value: 1200,
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('passes on indexed-attribute orderBy', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          orderBy: [
            { attribute: PuzzleAttr.popularity.key, direction: 'desc' },
          ],
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('passes on patch/* meta attribute even when not in any schema', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'exists',
            attribute: asKeyword('patch/created-by-id'),
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('passes on `exists` against non-indexed declared attribute', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'exists',
            attribute: PuzzleAttr.themes.key,
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('unregistered entity types are skipped (incremental rollout)', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'no.such.entity',
          where: { type: '=', attribute: PuzzleAttr.id.key, value: 'x' },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('entity/owner is universally allowed even when not in the schema', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: '=',
            attribute: asKeyword('entity/owner'),
            value: 'user-1',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('crashes on undeclared attribute', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: '=',
            attribute: asKeyword('test/not-declared'),
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/not declared on this entity type/);
  });

  test('crashes on range filter against non-indexed attribute', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'gte',
            attribute: PuzzleAttr.themes.key,
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/non-indexed attribute/);
  });

  test('crashes on orderBy against non-indexed attribute', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          orderBy: [{ attribute: PuzzleAttr.themes.key, direction: 'asc' }],
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/non-indexed attribute/);
  });

  test('crashes on equality filter against non-indexed attribute', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: '=',
            attribute: PuzzleAttr.themes.key,
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/non-indexed attribute/);
  });

  test('passes on AND/OR/NOT combinators when leaves pass', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'and',
            clauses: [
              { type: 'gte', attribute: PuzzleAttr.rating.key, value: 1200 },
              {
                type: 'not',
                clause: {
                  type: '=',
                  attribute: PuzzleAttr.id.key,
                  value: 'x',
                },
              },
            ],
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('crashes when AND/OR combinator hides a non-indexed leaf', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'or',
            clauses: [
              { type: 'gte', attribute: PuzzleAttr.rating.key, value: 1200 },
              { type: '=', attribute: PuzzleAttr.themes.key, value: 'fork' },
            ],
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/non-indexed attribute/);
  });

  test('cross-type query skipped by default (no entityType)', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          where: {
            type: '=',
            attribute: PuzzleAttr.id.key,
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('cross-type query crashes when strictCrossType=true', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          where: {
            type: '=',
            attribute: PuzzleAttr.id.key,
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry,
        { strictCrossType: true }
      )
    ).toThrow(/cross-type query/);
  });

  test('cross-type query with only meta attributes never crashes', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          where: {
            type: 'exists',
            attribute: asKeyword('patch/created-by-id'),
          },
        } satisfies PatchDbQuery,
        registry,
        { strictCrossType: true }
      )
    ).not.toThrow();
  });

  test('contains clause: declared attribute is fine even without index', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'contains',
            attribute: PuzzleAttr.themes.key,
            value: 'fork',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).not.toThrow();
  });

  test('contains clause: undeclared attribute still crashes', () => {
    expect(() =>
      assertQueryAgainstSchema(
        {
          entityType: 'test.puzzle',
          where: {
            type: 'contains',
            attribute: asKeyword('test/undeclared'),
            value: 'x',
          },
        } satisfies PatchDbQuery,
        registry
      )
    ).toThrow(/not declared on this entity type/);
  });
});
