#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun run conformance`): reads recorded evidence, asks turbo and git, writes the report.
/**
 * `bun run conformance`: the product-conformance and production-readiness
 * verdicts (strategy §§ 13, 23.11, 25.3) from the evidence the suites
 * recorded, never from running anything itself.
 *
 * It reads every `<package>/.cache/harness-report/<bucket>/evidence/` (the
 * `test:spec` parts) and `<package>/.cache/health-report/**` evidence (the
 * live `health` run), checks each record against the spec's current text
 * (another text is stale: FAIL), requires evidence for every spec a suite
 * runs (none: FAIL), asks the build cache whether each release gate passed
 * for the current inputs, and prints the pipeline — SPECIFICATION,
 * IMPLEMENTATION, SYSTEM, RELEASE / LIVE, COMPLETENESS, a PASS or FAIL and
 * counts per line — then `PRODUCT CONFORMANCE` and `PRODUCTION READINESS`.
 * The report (spec revision, commit and dirty flag, environment, verdicts
 * and every evidence record) is written to `.cache/conformance/report.json`.
 *
 * Not a gate task: its evidence exists only once the suites ran. Use it
 *
 *   - after `bun check:local` (turbo runs or restores every `test:spec:<k>`
 *     part, and each part's outputs are its `.cache/harness-report/part-<k>/`
 *     bucket), or after the restore step `bun check:report` runs on GitHub
 *     (`turbo-ci-run.ts --restore-outputs`), which leaves every bucket on disk;
 *   - with live evidence after `bun health` (SECRETS_ENV names the
 *     environment), for the RELEASE / LIVE lines and PRODUCTION READINESS.
 *
 * Exits 0 only when PRODUCTION READINESS is PASS.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { closureProblems } from '@pkgs/conformance/closure';
import { type EvidenceRecord, sha256 } from '@pkgs/conformance/evidence';
import { readEvidence } from '@pkgs/conformance/evidence-store';

import {
  evaluateLines,
  type ReportInput,
  type ReportSpec,
} from '../conformance/evaluate';
import { EVIDENCE_MAP, RELEASE_GATE_TASKS } from '../conformance/evidence-map';
import { gateVerdicts } from '../conformance/gate-verdicts';
import {
  type ConformanceReport,
  decideVerdict,
  renderVerdict,
  specRevision,
} from '../conformance/verdict';
import { readConformanceWorld } from '../conformance/world';
import { REPO_ROOT, SPECS_DIR } from './spec-packages';

const REPORT_PATH = '.cache/conformance/report.json';

function subdirs(dir: string): readonly string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(dir, entry.name));
}

/** Report dirs under `dir` holding an `evidence/` folder, `dir` included. */
function withEvidence(dir: string, depth: number): readonly string[] {
  if (!existsSync(dir)) return [];
  const own = existsSync(join(dir, 'evidence')) ? [dir] : [];
  if (depth === 0) return own;
  return [
    ...own,
    ...subdirs(dir)
      .filter((sub) => !sub.endsWith('/evidence'))
      .flatMap((sub) => withEvidence(sub, depth - 1)),
  ];
}

/** Every report bucket in the repository that may hold evidence. */
function reportBuckets(): readonly string[] {
  return [
    // Root gates that record evidence (`//#ci:models`).
    ...subdirs(join(REPO_ROOT, '.cache/harness-report')),
    ...['apps', 'libs', 'pkgs'].flatMap((tier) =>
      subdirs(join(REPO_ROOT, tier)).flatMap((pkg) => [
        ...subdirs(join(pkg, '.cache/harness-report')),
        ...withEvidence(join(pkg, '.cache/health-report'), 2),
      ])
    ),
  ];
}

function git(args: readonly string[]): string {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function specTreeFiles(): readonly { path: string; sha256: string }[] {
  return [
    ...new Bun.Glob('**/*').scanSync({ cwd: join(REPO_ROOT, SPECS_DIR) }),
  ].map((file) => ({
    path: `${SPECS_DIR}/${file}`,
    sha256: sha256(readFileSync(join(REPO_ROOT, SPECS_DIR, file), 'utf8')),
  }));
}

const { world, manifest, packages, specs, problems } = readConformanceWorld();
const closure = [
  ...problems,
  ...(world === null ? [] : closureProblems(world)),
];
const scenarios = new Map(
  packages.flatMap((pkg) =>
    pkg.features.map(
      (feature) => [feature.uri, feature.scenarios.map((s) => s.name)] as const
    )
  )
);
const reportSpecs: ReportSpec[] = specs.map((spec) => ({
  ...spec,
  sha256: sha256(readFileSync(join(REPO_ROOT, spec.path), 'utf8')),
  accessibility: EVIDENCE_MAP.accessibility.includes(spec.path),
  scenarios: scenarios.get(spec.path) ?? [],
}));

const records: EvidenceRecord[] = [];
const malformed: string[] = [];
for (const bucket of reportBuckets()) {
  const read = readEvidence(bucket);
  records.push(...read.records);
  malformed.push(...read.malformed);
}

const decisionSpec = new Map(
  (world?.decisions ?? []).map((d) => [d.id, d.specUri])
);
const input: ReportInput = {
  specs: reportSpecs,
  records,
  malformed,
  closure,
  capabilities: (manifest?.product.capabilities ?? []).map((capability) => ({
    id: capability.id,
    decision: capability['decided by'],
    specUri:
      decisionSpec.get(capability['decided by']) ?? '(no decision table)',
  })),
  gateTasks: RELEASE_GATE_TASKS,
  gates: await gateVerdicts(RELEASE_GATE_TASKS),
};

const verdict = decideVerdict({
  lines: evaluateLines(input),
  require: manifest?.['production readiness'].require ?? null,
  readiness: EVIDENCE_MAP['production readiness'],
});
const current = new Map(reportSpecs.map((spec) => [spec.path, spec.sha256]));
const report: ConformanceReport = {
  ...verdict,
  specRevision: specRevision(specTreeFiles(), sha256),
  artifact: {
    commit: git(['rev-parse', 'HEAD']),
    dirty: git(['status', '--porcelain']) !== '',
  },
  environment: {
    secretsEnv: process.env['SECRETS_ENV']?.trim() || null,
    platform: process.platform,
    arch: process.arch,
    bun: Bun.version,
  },
  evidence: records.map((record) => ({
    ...record,
    fresh: current.get(record.specUri) === record.specSha256,
  })),
};
mkdirSync(join(REPO_ROOT, '.cache/conformance'), { recursive: true });
writeFileSync(
  join(REPO_ROOT, REPORT_PATH),
  `${JSON.stringify(report, null, 2)}\n`
);

console.log(renderVerdict(verdict));
console.log(
  `\nspec revision ${report.specRevision.slice(0, 12)} · commit ${report.artifact.commit.slice(0, 12)}${report.artifact.dirty ? ' (dirty)' : ''} · ${String(records.length)} evidence records · ${REPORT_PATH}`
);
process.exit(verdict.productionReadiness === 'pass' ? 0 : 1);
