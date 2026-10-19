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
      `libs/a/package.json: specParts must be an integer from 1 to ${String(MAX_SPEC_PARTS)} — bun verify runs the suite as test:spec:0 … test:spec:<specParts - 1>`,
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
  const scripts = { 'verify:models': MODELS_RUNNER };
  const inputs = [
    '$TURBO_EXTENDS$',
    '$TURBO_ROOT$/specs/a/*.qnt',
    '$TURBO_ROOT$/specs/b/*.qnt',
  ];

  test("a package verifying its models, hashing only their domains' models, is clean", () => {
    expect(modelTaskProblems(pkg, scripts, inputs)).toEqual([]);
  });

  test('a package with models must verify them', () => {
    expect(modelTaskProblems(pkg, {}, inputs)).toEqual([
      `libs/a/package.json: "verify:models" must be "${MODELS_RUNNER}" — it has Quint models to verify`,
    ]);
  });

  test('a package without models has no models verification', () => {
    expect(
      modelTaskProblems({ ...pkg, models: [] }, scripts, undefined)
    ).toEqual([
      'libs/a/package.json: "verify:models" verifies no Quint models — delete it',
    ]);
    expect(modelTaskProblems({ ...pkg, models: [] }, {}, undefined)).toEqual(
      []
    );
  });

  test('a split models verification has every part, each hashing the models, and no whole verification', () => {
    const part = (index: number) =>
      `${MODELS_RUNNER} --part ${String(index)}/2`;
    const split = { 'verify:models:0': part(0), 'verify:models:1': part(1) };
    const parts = { count: 2, inputsOf: () => inputs };
    expect(modelTaskProblems(pkg, split, undefined, parts)).toEqual([]);
    expect(
      modelTaskProblems(
        pkg,
        {
          ...split,
          'verify:models': MODELS_RUNNER,
          'verify:models:2': part(2),
        },
        undefined,
        parts
      )
    ).toEqual([
      'libs/a/package.json: "verify:models" would verify every model again — the 2 parts replace it; delete it',
      'libs/a/package.json: "verify:models:2" is past modelParts (2) — delete it',
    ]);
    expect(
      modelTaskProblems(pkg, { 'verify:models:0': part(0) }, undefined, {
        count: 2,
        inputsOf: (task) =>
          task === 'verify:models:0' ? inputs : inputs.slice(0, 2),
      })
    ).toEqual([
      `libs/a/package.json: "verify:models:1" must be "${part(1)}"`,
      'libs/a/turbo.json: verify:models:1 inputs must include "$TURBO_ROOT$/specs/b/*.qnt" so a model change re-verifies @libs/a',
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
        { ...scripts, 'verify:models:0': part(0) },
        inputs,
        { count: undefined, inputsOf: () => inputs }
      )
    ).toEqual([
      'libs/a/package.json: "verify:models:0" is a part of no split — declare modelParts or delete it',
    ]);
  });

  test('proof groups partition one model and a stray phase names its part', () => {
    const one = { ...pkg, models: ['specs/a/door.qnt'] };
    const inputsOf = () => ['$TURBO_ROOT$/specs/a/*.qnt'];
    const grouped = {
      'verify:models:0': `${MODELS_RUNNER} --phase 1/3`,
      'verify:models:1': `${MODELS_RUNNER} --phase 0,2/3`,
    };
    expect(
      modelTaskProblems(one, grouped, undefined, {
        count: undefined,
        proofParts: 3,
        proofGroups: ['1', '0,2'],
        inputsOf,
      })
    ).toEqual([]);
    expect(
      modelTaskProblems(
        one,
        { ...grouped, 'verify:models:2': `${MODELS_RUNNER} --phase 0/3` },
        undefined,
        {
          count: undefined,
          proofParts: 3,
          proofGroups: ['1', '0,2'],
          inputsOf,
        }
      )[0]
    ).toContain('past 2 proof groups');
    expect(
      modelTaskProblems(
        pkg,
        { 'verify:models:1:0': `${MODELS_RUNNER}` },
        undefined,
        {
          count: 2,
          inputsOf: () => inputs,
        }
      )
    ).toEqual([
      'libs/a/package.json: "verify:models:1:0" is a phase of no split — declare phaseParts or delete it',
      `libs/a/package.json: "verify:models:0" must be "${MODELS_RUNNER} --part 0/2"`,
      `libs/a/package.json: "verify:models:1" must be "${MODELS_RUNNER} --part 1/2"`,
    ]);
  });

  test("the task must hash every domain's models, or an edit is served stale", () => {
    expect(modelTaskProblems(pkg, scripts, inputs.slice(0, 2))).toEqual([
      'libs/a/turbo.json: verify:models inputs must include "$TURBO_ROOT$/specs/b/*.qnt" so a model change re-verifies @libs/a',
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
