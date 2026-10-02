#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`check:models` in each package with models): runs the pinned checkers and writes evidence.
/**
 * A package's models check requires every public safety and temporal
 * property. Apalache explores every transition within the declared bound,
 * or proves a declared inductive candidate initially, under every step, and
 * as implying every safety property. Models declaring temporal properties
 * use TLC to check safety and progress across their complete finite graph.
 *
 * Run from the package (`check:models`, `MODELS_RUNNER` in `spec-packages.ts`). The verdict
 * depends on the model's text alone, never on the product, so the task hashes
 * only the package's `specs/<domain>/*.qnt` and `tests/quint/**` (its
 * `turbo.json`) and runs apart from the spec suite, where each check's JVM
 * would compete with the product traces: a change re-checks only the models
 * of the packages it touches. The bound is the model binding's `verifySteps`
 * (read from the binding's text; `@pkgs/quint` documents it), default
 * {@link DEFAULT_VERIFY_STEPS}. At most {@link CONCURRENCY} checks run at
 * once.
 *
 * The model's shape is recorded as its `shape` obligation first. A model
 * that fails that check is not sent to a checker. A passing shape and the
 * checker verdict are the model's `shape` and `verify` obligations in the
 * package's `.cache/harness-report/models/evidence/` for `bun run conformance`.
 * Each declared temporal property also requires its own evidence obligation.
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sha256 } from '@pkgs/conformance/evidence';
import { recordEvidence } from '@pkgs/conformance/evidence-store';
import { DEFAULT_VERIFY_STEPS } from '@pkgs/quint/registry';
import { formatModelShapeIssue, modelShapeIssues } from '@pkgs/quint/shape';
import { modelInvariants } from '@pkgs/quint/simulate';
import { modelTemporalProperties, verifyTemporal } from '@pkgs/quint/temporal';
import { verify } from '@pkgs/quint/verify';

import { REPO_ROOT, type SpecPackage, specPackages } from './spec-packages';

/**
 * One model at a time. Each check is a JVM plus an SMT solver, and the
 * Check runner has two cores. Friendship and space hosting both ran out
 * the 240s bound at step 4 when they solved together.
 */
const CONCURRENCY = 1;
/** A timeout is a failed obligation; improve the abstraction or proof strategy. */
const TIMEOUT_MS = 240_000;
/** Package-relative; the `check:models` task's output. */
const REPORT_DIR = '.cache/harness-report/models';
const VERIFY_STEPS = /\bverifySteps:\s*(\d+)/;
const MODEL_BINDING = /\bmodel:\s*['"]([a-z0-9-]+)['"]/;
const INDUCTIVE_INVARIANT = /\binductiveInvariant:\s*['"]([A-Za-z_]\w*)['"]/;

export type ModelCheck = {
  /** Repo-relative model path (`specs/friends/friendship.qnt`). */
  readonly specUri: string;
  readonly steps: number;
  readonly inductiveInvariant: string | null;
};

/** The bound a binding's text declares, or the default. */
export function verifyStepsOf(bindingText: string | null): number {
  const match = bindingText === null ? null : VERIFY_STEPS.exec(bindingText);
  return match?.[1] === undefined ? DEFAULT_VERIFY_STEPS : Number(match[1]);
}

function bindingTexts(dir: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const quintDir = join(REPO_ROOT, dir, 'tests/quint');
  if (!existsSync(quintDir)) return out;
  for (const file of new Bun.Glob('**/*.ts').scanSync({ cwd: quintDir })) {
    const text = readFileSync(join(quintDir, file), 'utf8');
    const model = MODEL_BINDING.exec(text)?.[1];
    if (model !== undefined) out.set(model, text);
  }
  return out;
}

/** The package's models, each with its bound. */
export function modelChecks(
  pkg: Pick<SpecPackage, 'dir' | 'models'>
): readonly ModelCheck[] {
  const texts = bindingTexts(pkg.dir);
  return pkg.models
    .map((specUri) => {
      const stem = specUri.replace(/^.*\//, '').replace(/\.qnt$/, '');
      const binding = texts.get(stem) ?? null;
      return {
        specUri,
        steps: verifyStepsOf(binding),
        inductiveInvariant:
          binding === null
            ? null
            : (INDUCTIVE_INVARIANT.exec(binding)?.[1] ?? null),
      };
    })
    .sort((a, b) => a.specUri.localeCompare(b.specUri));
}

type Verdict = {
  readonly check: ModelCheck;
  readonly ok: boolean;
  readonly detail: string;
};

/** Where one package's run writes, and the name its evidence carries. */
type Run = { readonly reportDir: string; readonly packageName: string };

function record(
  run: Run,
  check: ModelCheck,
  text: string,
  obligations: readonly {
    readonly id: string;
    readonly status: 'pass' | 'fail';
    readonly detail: string;
  }[]
): void {
  recordEvidence(run.reportDir, {
    specUri: check.specUri,
    kind: 'dynamics',
    specSha256: sha256(text),
    packageName: run.packageName,
    obligations: obligations.map((obligation) => ({
      id: obligation.id,
      layer: 'specification',
      status: obligation.status,
      detail: obligation.detail,
    })),
  });
}

async function runCheck(run: Run, check: ModelCheck): Promise<Verdict> {
  const specPath = join(REPO_ROOT, check.specUri);
  const text = readFileSync(specPath, 'utf8');
  const shape = modelShapeIssues(text, check.specUri).map((found) =>
    formatModelShapeIssue(check.specUri, found)
  );
  if (shape.length > 0) {
    const detail = shape.join('\n');
    record(run, check, text, [{ id: 'shape', status: 'fail', detail }]);
    console.log(`FAIL ${check.specUri} · shape`);
    return { check, ok: false, detail };
  }
  return checkModel(run, check, text);
}

async function checkModel(
  run: Run,
  check: ModelCheck,
  text: string
): Promise<Verdict> {
  const specPath = join(REPO_ROOT, check.specUri);
  const invariants = modelInvariants(text);
  const properties = modelTemporalProperties(text);
  const outName = check.specUri.replace(/\W+/g, '-');
  const result =
    properties.length > 0
      ? await verifyTemporal({
          specPath,
          properties,
          invariants,
          outDir: join(run.reportDir, 'tlc', outName),
          timeoutMs: TIMEOUT_MS,
        })
      : await verify({
          specPath,
          invariants,
          maxSteps: check.steps,
          ...(check.inductiveInvariant === null
            ? {}
            : { inductiveInvariant: check.inductiveInvariant }),
          outDir: join(run.reportDir, 'apalache', outName),
          timeoutMs: TIMEOUT_MS,
        });
  const strategy = modelStrategy(check, properties);
  const states =
    result.ok && 'statesExplored' in result && 'searchDepth' in result
      ? ` (${result.statesExplored} distinct states; graph search depth ${result.searchDepth})`
      : '';
  const detail = result.ok
    ? `${invariants.join(', ')} hold by ${strategy}${states}`
    : result.output;
  record(run, check, text, [
    { id: 'shape', status: 'pass', detail: 'valid aggregate shape' },
    { id: 'verify', status: result.ok ? 'pass' : 'fail', detail },
    ...properties.map((property) => ({
      id: `temporal:${property}`,
      status: result.ok ? ('pass' as const) : ('fail' as const),
      detail: result.ok
        ? `TLC checked ${property} across the ${strategy}${states}`
        : result.output,
    })),
  ]);
  const took = result.ok ? ` (${(result.durationMs / 1000).toFixed(1)} s)` : '';
  console.log(
    `${result.ok ? 'ok  ' : 'FAIL'} ${check.specUri} · ${strategy}${states}${took}`
  );
  return { check, ok: result.ok, detail };
}

function modelStrategy(
  check: ModelCheck,
  properties: readonly string[]
): string {
  if (properties.length > 0) return 'complete finite graph, including cycles';
  if (check.inductiveInvariant === null)
    return `every state within ${check.steps} steps`;
  return `induction through ${check.inductiveInvariant}: initial states, preservation, and implication`;
}

async function runAll(
  run: Run,
  checks: readonly ModelCheck[]
): Promise<readonly Verdict[]> {
  const verdicts: Verdict[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let index = next++; index < checks.length; index = next++) {
      const check = checks[index];
      if (check !== undefined) verdicts.push(await runCheck(run, check));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return verdicts;
}

if (import.meta.main) {
  const dir = relative(REPO_ROOT, process.cwd());
  const pkg = specPackages().find((candidate) => candidate.dir === dir);
  if (pkg === undefined || pkg.models.length === 0) {
    console.error(
      `check-models: ${dir} runs no Quint models — run it from a package's check:models`
    );
    process.exit(1);
  }
  const run: Run = {
    reportDir: join(REPO_ROOT, dir, REPORT_DIR),
    packageName: `${pkg.name}#check:models`,
  };
  rmSync(run.reportDir, { recursive: true, force: true });
  const checks = modelChecks(pkg);
  const verdicts = await runAll(run, checks);
  const failed = verdicts.filter((verdict) => !verdict.ok);
  if (failed.length > 0) {
    console.error(
      `${pkg.name} models check failed:\n${failed
        .map(
          (verdict) =>
            `  ${verdict.check.specUri}:\n    ${verdict.detail.replace(/\n/g, '\n    ')}`
        )
        .join('\n')}`
    );
    process.exit(1);
  }
  console.log(
    `ok: ${String(checks.length)} Quint models model-checked (${join(dir, REPORT_DIR)})`
  );
}
