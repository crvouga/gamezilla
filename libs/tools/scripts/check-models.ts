#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`check:models` in each package with models): runs Apalache and writes evidence.
/**
 * A package's models check: Apalache model-checks every Quint model in the
 * package's `specDomains` (`quint verify`, `@pkgs/quint/verify`), requiring
 * every `val inv<Name>` in every state reachable within the model's bound —
 * every action, every value it can draw, every interleaving.
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
 * Each verdict is recorded as the model's `verify` obligation in the
 * package's `.cache/harness-report/models/evidence/` for `bun run conformance`.
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sha256 } from '@pkgs/conformance/evidence';
import { recordEvidence } from '@pkgs/conformance/evidence-store';
import { DEFAULT_VERIFY_STEPS } from '@pkgs/quint/registry';
import { modelInvariants } from '@pkgs/quint/simulate';
import { verify } from '@pkgs/quint/verify';

import { REPO_ROOT, type SpecPackage, specPackages } from './spec-packages';

/** Checks at once: each is a JVM with an SMT solver, several cores busy. */
const CONCURRENCY = 3;
/** A check is killed after this long (the binding lowers the bound instead). */
const TIMEOUT_MS = 240_000;
/** Package-relative; the `check:models` task's output. */
const REPORT_DIR = '.cache/harness-report/models';
const VERIFY_STEPS = /\bverifySteps:\s*(\d+)/;
const MODEL_BINDING = /\bmodel:\s*['"]([a-z0-9-]+)['"]/;

export type ModelCheck = {
  /** Repo-relative model path (`specs/friends/friendship.qnt`). */
  readonly specUri: string;
  readonly steps: number;
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
      return { specUri, steps: verifyStepsOf(texts.get(stem) ?? null) };
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

async function runCheck(run: Run, check: ModelCheck): Promise<Verdict> {
  const specPath = join(REPO_ROOT, check.specUri);
  const text = readFileSync(specPath, 'utf8');
  const invariants = modelInvariants(text);
  const result = await verify({
    specPath,
    invariants,
    maxSteps: check.steps,
    outDir: join(run.reportDir, 'apalache', check.specUri.replace(/\W+/g, '-')),
    timeoutMs: TIMEOUT_MS,
  });
  const detail = result.ok
    ? `${invariants.join(', ')} hold in every state within ${String(check.steps)} steps`
    : result.output;
  recordEvidence(run.reportDir, {
    specUri: check.specUri,
    kind: 'dynamics',
    specSha256: sha256(text),
    packageName: run.packageName,
    obligations: [
      {
        id: 'verify',
        layer: 'specification',
        status: result.ok ? 'pass' : 'fail',
        detail,
      },
    ],
  });
  const took = result.ok ? ` (${(result.durationMs / 1000).toFixed(1)} s)` : '';
  console.log(
    `${result.ok ? 'ok  ' : 'FAIL'} ${check.specUri} · ${String(check.steps)} steps${took}`
  );
  return { check, ok: result.ok, detail };
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
