/**
 * The spec kinds `test-spec.ts` runs besides Gherkin features and Quint
 * models: each verifies one spec file against the package's bindings in one
 * generated `bun test` file (one part unit), through its engine's stubs.
 *
 *   specs/<domain>/<table>.dmn           decisions   tests/dmn/index.ts
 *   specs/<domain>/<structure>.als       structure   tests/alloy/index.ts
 *   specs/<domain>/<name>.openslo.yaml   objectives  tests/openslo/index.ts
 */

import { alloyStubFileName, alloyStubSource } from '@pkgs/alloy-shared/stubs';
import { dmnStubFileName, dmnStubSource } from '@pkgs/dmn-shared/stubs';
import { sloStubFileName, sloStubSource } from '@pkgs/openslo-shared/stubs';

export type VerifyStubInput = {
  readonly packageName: string;
  /** Absolute path of the spec file. */
  readonly specPath: string;
  /** Repo-relative uri used in reports and evidence. */
  readonly specUri: string;
  /** Absolute path of the package's `tests/<dir>/index.ts`. */
  readonly entry: string;
  /** Absolute path of the engine's bun:test bridge module. */
  readonly bridge: string;
  readonly reportDir: string;
};

export type VerifyKind = {
  /** File suffix under `specs/<domain>/`. */
  readonly suffix: string;
  /** The package's binding directory, `tests/<dir>/`. */
  readonly dir: string;
  /** The engine's bun:test bridge, resolved from here. */
  readonly bridge: string;
  /** What the package's specDomains hold, for a missing entry. */
  readonly what: string;
  readonly fileName: (specUri: string) => string;
  readonly source: (input: VerifyStubInput) => string;
};

function entryHint(dir: string, spec: string): string {
  return `an entry importing one tests/${dir}/<stem>.binding.ts per ${spec} (each with spec: '<stem>')`;
}

export const VERIFY_KINDS: readonly VerifyKind[] = [
  {
    suffix: '.dmn',
    dir: 'dmn',
    bridge: '@pkgs/dmn-server/bun-test',
    what: `DMN decision tables needs ${entryHint('dmn', 'table')}`,
    fileName: dmnStubFileName,
    source: dmnStubSource,
  },
  {
    suffix: '.als',
    dir: 'alloy',
    bridge: '@pkgs/alloy-server/bun-test',
    what: `Alloy structures needs ${entryHint('alloy', 'structure')}`,
    fileName: alloyStubFileName,
    source: alloyStubSource,
  },
  {
    suffix: '.openslo.yaml',
    dir: 'openslo',
    bridge: '@pkgs/openslo-server/bun-test',
    what: `OpenSLO objectives needs ${entryHint('openslo', 'objective file')}`,
    fileName: sloStubFileName,
    source: sloStubSource,
  },
];

/** The kind that verifies `path`, or undefined for a feature or a model. */
export function verifyKindOf(path: string): VerifyKind | undefined {
  return VERIFY_KINDS.find((kind) => path.endsWith(kind.suffix));
}

/** Every spec path `test-spec.ts` runs: features, models and the verification kinds. */
export function isSpecPath(path: string): boolean {
  return (
    path.endsWith('.feature') ||
    path.endsWith('.qnt') ||
    verifyKindOf(path) !== undefined
  );
}

/** `Bun.Glob` patterns for the spec files of one `specs/<domain>/`. */
export const SPEC_GLOBS: readonly string[] = [
  '*.{feature,qnt}',
  ...VERIFY_KINDS.map((kind) => `*${kind.suffix}`),
];
