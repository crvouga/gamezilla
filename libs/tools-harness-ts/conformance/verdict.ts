import { checkRelease } from '@pkgs/conformance-shared-ts/release-check';
/**
 * The two verdicts of `bun run conformance` and how they are printed and
 * recorded (strategy §§ 13, 23.11, 25.3). Pure: `conformance-report.ts`
 * gathers the inputs.
 *
 * PRODUCT CONFORMANCE passes when every line outside RELEASE / LIVE passes —
 * what the harness suites can prove. PRODUCTION READINESS also needs every
 * RELEASE / LIVE line and every requirement the manifest's
 * `production readiness.require` lists, each decided by the report lines the
 * evidence map names for it. There is no third status.
 */

import type {
  EvidenceRecord,
  Layer,
} from '@pkgs/conformance-shared-ts/evidence';
import type { ProofTable } from '@pkgs/conformance-shared-ts/proofs';

import type { LineResult } from './evaluate';
import type { VariantCell } from './variant-evidence';

export type RequirementResult = {
  readonly id: string;
  readonly status: 'pass' | 'fail';
  readonly lines: readonly string[];
  readonly problems: readonly string[];
};

export type Verdict = {
  readonly edition: string;
  readonly lines: readonly LineResult[];
  readonly requirements: readonly RequirementResult[];
  readonly productConformance: 'pass' | 'fail';
  readonly productionReadiness: 'pass' | 'fail';
};

function requirementResult(
  id: string,
  proofs: ProofTable[string] | undefined,
  lines: readonly LineResult[]
): RequirementResult {
  if (proofs === undefined || proofs.length === 0) {
    return {
      id,
      status: 'fail',
      lines: [],
      problems: ['missing automation — no report line decides it'],
    };
  }
  const ids = proofs.flatMap((proof) => ('line' in proof ? [proof.line] : []));
  const problems: string[] = [];
  for (const lineId of ids) {
    const line = lines.find((candidate) => candidate.id === lineId);
    if (line === undefined)
      problems.push(`report line "${lineId}" does not exist`);
    else if (line.status === 'fail') problems.push(`${line.label} failed`);
  }
  if (ids.length < proofs.length) {
    problems.push('only report lines decide a requirement — map it to lines');
  }
  return {
    id,
    status: problems.length === 0 ? 'pass' : 'fail',
    lines: ids,
    problems,
  };
}

export function decideVerdict(input: {
  readonly edition: string;
  readonly lines: readonly LineResult[];
  /** The manifest's `production readiness.require`; null when it did not parse. */
  readonly require: readonly string[] | null;
  readonly readiness: ProofTable;
}): Verdict {
  const { lines } = input;
  const conformance = lines
    .filter((line) => line.section !== 'release')
    .every((line) => line.status === 'pass');
  const requirements = (input.require ?? []).map((id) =>
    requirementResult(id, input.readiness[id], lines)
  );
  const ready =
    conformance &&
    input.require !== null &&
    checkRelease({
      edition: input.edition,
      required: lines.map((line) => line.id),
      evidence: lines.map((line) => ({
        obligation: line.id,
        edition: input.edition,
        status: line.status,
        automated: true,
      })),
    }).status === 'pass' &&
    requirements.every((requirement) => requirement.status === 'pass');
  return {
    edition: input.edition,
    lines,
    requirements,
    productConformance: conformance ? 'pass' : 'fail',
    productionReadiness: ready ? 'pass' : 'fail',
  };
}

const SECTIONS: readonly (readonly [Layer, string])[] = [
  ['specification', 'SPECIFICATION'],
  ['implementation', 'IMPLEMENTATION'],
  ['system', 'SYSTEM'],
  ['release', 'RELEASE / LIVE'],
  ['completeness', 'COMPLETENESS'],
];

const WIDTH = 46;
/** How many problems of one line are printed before "… and n more". */
const SHOWN = 8;

const word = (status: 'pass' | 'fail'): string => status.toUpperCase();

function lineText(line: LineResult): string {
  const counts = `${String(line.passed)}/${String(line.total)}`;
  return `    ${line.label.padEnd(WIDTH)} ${word(line.status)}  ${counts}`;
}

/** The § 13 pipeline, then what failed and why. */
export function renderVerdict(verdict: Verdict): string {
  const out: string[] = ['product verify', ''];
  for (const [index, [section, title]] of SECTIONS.entries()) {
    out.push(`${String(index + 1)}. ${title}`);
    for (const line of verdict.lines.filter((l) => l.section === section)) {
      out.push(lineText(line));
    }
    out.push('');
  }
  out.push('REQUIREMENTS (production readiness)');
  for (const requirement of verdict.requirements) {
    out.push(`    ${requirement.id.padEnd(WIDTH)} ${word(requirement.status)}`);
  }
  out.push('');
  const failing = verdict.lines.filter((line) => line.status === 'fail');
  for (const line of failing) {
    out.push(`${line.label}:`);
    for (const problem of line.problems.slice(0, SHOWN))
      out.push(`  ${problem}`);
    if (line.problems.length > SHOWN) {
      out.push(`  … and ${String(line.problems.length - SHOWN)} more`);
    }
  }
  if (failing.length > 0) out.push('');
  out.push(`PRODUCT CONFORMANCE: ${word(verdict.productConformance)}`);
  out.push(`PRODUCTION READINESS: ${word(verdict.productionReadiness)}`);
  return out.join('\n');
}

export type ConformanceReport = Verdict & {
  /** sha256 over every file under `specs/`, path and text. */
  readonly specRevision: string;
  readonly artifact: { readonly commit: string; readonly dirty: boolean };
  readonly environment: {
    readonly secretsEnv: string | null;
    readonly platform: string;
    readonly arch: string;
    readonly bun: string;
  };
  readonly evidence: readonly (EvidenceRecord & { readonly fresh: boolean })[];
  /** Every variant cell of a spec run per variant: passed, failed, stale, missing or not applicable. */
  readonly variants: readonly VariantCell[];
};

/** The revision of a spec tree: its files' paths and hashes, in path order. */
export function specRevision(
  files: readonly { readonly path: string; readonly sha256: string }[],
  hash: (text: string) => string
): string {
  return hash(
    [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => `${file.path}\0${file.sha256}\n`)
      .join('')
  );
}
