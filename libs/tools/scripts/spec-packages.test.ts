import { describe, expect, test } from 'bun:test';
import { liveObjectivePaths } from './spec-live';
import {
  MAX_SPEC_PARTS,
  MODELS_RUNNER,
  modelTaskProblems,
  specPackages,
  specPartProblems,
} from './spec-packages';

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

describe('modelTaskProblems', () => {
  const pkg = {
    dir: 'libs/a',
    name: '@libs/a',
    models: ['specs/a/door.qnt', 'specs/b/lock.qnt'],
  };
  const scripts = { 'check:models': MODELS_RUNNER };
  const inputs = [
    '$TURBO_EXTENDS$',
    '$TURBO_ROOT$/specs/a/*.qnt',
    '$TURBO_ROOT$/specs/b/*.qnt',
  ];

  test("a package checking its models, hashing only their domains' models, is clean", () => {
    expect(modelTaskProblems(pkg, scripts, inputs)).toEqual([]);
  });

  test('a package with models must check them', () => {
    expect(modelTaskProblems(pkg, {}, inputs)).toEqual([
      `libs/a/package.json: "check:models" must be "${MODELS_RUNNER}" — it has Quint models to check`,
    ]);
  });

  test('a package without models has no models check', () => {
    expect(
      modelTaskProblems({ ...pkg, models: [] }, scripts, undefined)
    ).toEqual([
      'libs/a/package.json: "check:models" checks no Quint models — delete it',
    ]);
    expect(modelTaskProblems({ ...pkg, models: [] }, {}, undefined)).toEqual(
      []
    );
  });

  test('a split models check has every part, each hashing the models, and no whole check', () => {
    const part = (index: number) =>
      `${MODELS_RUNNER} --part ${String(index)}/2`;
    const split = { 'check:models:0': part(0), 'check:models:1': part(1) };
    const parts = { count: 2, inputsOf: () => inputs };
    expect(modelTaskProblems(pkg, split, undefined, parts)).toEqual([]);
    expect(
      modelTaskProblems(
        pkg,
        { ...split, 'check:models': MODELS_RUNNER, 'check:models:2': part(2) },
        undefined,
        parts
      )
    ).toEqual([
      'libs/a/package.json: "check:models" would check every model again — the 2 parts replace it; delete it',
      'libs/a/package.json: "check:models:2" is past modelParts (2) — delete it',
    ]);
    expect(
      modelTaskProblems(pkg, { 'check:models:0': part(0) }, undefined, {
        count: 2,
        inputsOf: (task) =>
          task === 'check:models:0' ? inputs : inputs.slice(0, 2),
      })
    ).toEqual([
      `libs/a/package.json: "check:models:1" must be "${part(1)}"`,
      'libs/a/turbo.json: check:models:1 inputs must include "$TURBO_ROOT$/specs/b/*.qnt" so a model change re-checks @libs/a',
    ]);
    // A part holds at least one model, and a part needs a declared split.
    expect(
      modelTaskProblems(pkg, split, undefined, { ...parts, count: 3 })
    ).toEqual([
      "libs/a/package.json: modelParts must be an integer from 2 to 2 — a part holds at least one of the package's 2 models",
    ]);
    expect(
      modelTaskProblems(
        pkg,
        { ...scripts, 'check:models:0': part(0) },
        inputs,
        { count: undefined, inputsOf: () => inputs }
      )
    ).toEqual([
      'libs/a/package.json: "check:models:0" is a part of no split — declare modelParts or delete it',
    ]);
  });

  test("the task must hash every domain's models, or an edit is served stale", () => {
    expect(modelTaskProblems(pkg, scripts, inputs.slice(0, 2))).toEqual([
      'libs/a/turbo.json: check:models inputs must include "$TURBO_ROOT$/specs/b/*.qnt" so a model change re-checks @libs/a',
    ]);
  });
});

describe('specPackages', () => {
  const packages = specPackages();
  const inDomain = (path: string, domains: readonly string[]) =>
    domains.some((domain) => path.startsWith(`specs/${domain}/`));

  // regression: db-framework-contract-spec-discovery
  test('unbound database protocols stay in package model tests', () => {
    expect(packages.map((pkg) => pkg.name)).not.toContain(
      '@pkgs/db-schema-root-harness'
    );
    const models = packages.flatMap((pkg) => pkg.models);
    expect(models).not.toContain(
      'specs/db-schema/reconciliation-transaction.qnt'
    );
    expect(models).not.toContain('specs/db-schema/rebuild-recovery.qnt');
    expect(models).not.toContain('specs/db-indexes/index-reconciliation.qnt');
    const indexing = packages.find(
      (pkg) => pkg.name === '@pkgs/db-indexes-root-harness'
    );
    expect(indexing?.models).toEqual([
      'specs/db-indexes/index-interruption.qnt',
      'specs/db-indexes/index-retirement.qnt',
    ]);
    expect(indexing?.features).toHaveLength(6);
    expect(indexing?.definitions.length).toBeGreaterThan(0);
    expect(indexing?.problems).toEqual([]);
  });

  test('decision tables and structures come from the harness domains', () => {
    for (const pkg of packages) {
      for (const path of pkg.decisions) {
        expect(path.endsWith('.dmn') && inDomain(path, pkg.specDomains)).toBe(
          true
        );
      }
      for (const path of pkg.structures) {
        expect(path.endsWith('.als') && inDomain(path, pkg.specDomains)).toBe(
          true
        );
      }
    }
  });

  test('objectives come from harness and live domains alike', () => {
    const liveFiles = new Set(liveObjectivePaths());
    for (const pkg of packages) {
      const borrowsLive = pkg.liveDomains.length > 0;
      for (const path of pkg.objectives) {
        const owned =
          path.endsWith('.openslo.yaml') && inDomain(path, pkg.domains);
        // A live package also runs every `# live` objective, wherever it sits.
        const borrowed = borrowsLive && liveFiles.has(path);
        expect(owned || borrowed).toBe(true);
      }
    }
  });
});
