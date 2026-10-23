#!/usr/bin/env bun
// @io-wall-ok — CI gate entry (`verify:models` in each package with models): runs the pinned checkers and writes evidence.
/**
 * A package's models verification requires every public safety and temporal
 * property. Apalache explores every transition within the declared bound,
 * or proves a declared inductive candidate initially, under every step, and
 * as implying every safety property. Models declaring temporal properties
 * use TLC to verify safety and progress across their complete finite graph.
 *
 * Run from the package (`verify:models`, `MODELS_RUNNER` in `spec-packages.ts`). The verdict
 * depends on the model's text alone, never on the product, so the task hashes
 * only the package's `specs/<domain>/*.qnt` and `tests/quint/**` (its
 * `turbo.json`) and runs apart from the spec suite, where each verification's JVM
 * would compete with the product traces: a change re-verifies only the models
 * of the packages it touches. The bound is the model binding's `verifySteps`
 * (read from the binding's text; `@pkgs/quint` documents it), default
 * {@link DEFAULT_VERIFY_STEPS}. At most {@link CONCURRENCY} verifications run at
 * once.
 *
 * `--part k/n` verifies the k-th (0-based) of n shares of the package's models,
 * by their position in path order, so a package whose proofs outlast one
 * runner spreads them over several (`verify:models:<k>`, `modelParts`). The
 * parts write one report between them, and every model is in exactly one.
 *
 * The model's shape is recorded as its `shape` obligation first. A model
 * that fails that verification is not sent to a checker. A passing shape and the
 * checker verdict are the model's `shape` and `verify` obligations in the
 * package's `.cache/harness-report/models/evidence/` for `bun run conformance`.
 * Each declared temporal property also requires its own evidence obligation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { recordEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { sha256 } from '@pkgs/conformance-shared-ts/evidence';
import { modelInvariants } from '@pkgs/quint-server-ts/simulate';
import {
  modelTemporalProperties,
  type TemporalResult,
  verifyTemporal,
} from '@pkgs/quint-server-ts/temporal';
import type { VerifyResult } from '@pkgs/quint-server-ts/verify';
import { verify as quintVerify } from '@pkgs/quint-server-ts/verify';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '@pkgs/quint-shared-ts/registry';
import { modelShapeIssues } from '@pkgs/quint-shared-ts/shape';
import { formatModelShapeIssue } from '@pkgs/quint-shared-ts/shape-model';
import type { PhaseArg } from './model-phase';
import { parsePhaseArg } from './model-phase';
import { withModelWorkspace } from './model-verify-workspace';
import { withSolverSlot } from './solver-slots';
import type { SpecPackage } from './spec-packages';
import { REPO_ROOT, specPackages } from './spec-packages';

/**
 * Bound independent JVM/SMT processes separately from Turbo's task slots.
 * Every model keeps its declared proof strategy and timeout.
 */
const CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env['MODEL_VERIFY_CONCURRENCY'] ?? '4') || 4)
);
/** Package-relative; the `verify:models` task's output. */
const REPORT_DIR = '.cache/harness-report/models';
const VERIFY_STEPS = /\bverifySteps:\s*(\d+)/;
const MODEL_BINDING = /\bmodel:\s*['"]([a-z0-9-]+)['"]/;
const INDUCTIVE_INVARIANT = /\binductiveInvariant:\s*['"]([A-Za-z_]\w*)['"]/;
const ENCODING = /\bencoding:\s*['"](fun-arrays)['"]/;
const INVARIANT_MODE = /\binvariantMode:\s*['"](before|after)['"]/;
const SEPARATE_INDUCTION = /\bseparateInduction:\s*true\b/;
const INDUCTION_CASE_GROUP_SIZE = /\binductionCaseGroupSize:\s*(\d+)/;
const BOUNDED_INVARIANT_GROUP_SIZE = /\bboundedInvariantGroupSize:\s*(\d+)/;
const CONCRETE_TYPES = /\binferPolymorphicTypes:\s*false\b/;
const SHORT_CIRCUIT = /\bshortCircuit:\s*true\b/;
const VERIFY_TIMEOUT_MS = /\bverifyTimeoutMs:\s*([\d_]+)/;

export type ModelVerify = {
  /** Repo-relative model path (`specs/friends/friendship.qnt`). */
  readonly specUri: string;
  readonly steps: number;
  readonly inductiveInvariant: string | null;
  readonly encoding?: 'fun-arrays';
  readonly invariantMode?: 'before' | 'after';
  readonly separateInduction?: true;
  readonly inductionCaseGroupSize?: number;
  readonly boundedInvariantGroupSize?: number;
  readonly inferPolymorphicTypes?: false;
  readonly shortCircuit?: true;
  /** A timeout is a failed obligation; improve the abstraction or proof strategy. */
  readonly timeoutMs: number;
};

/** The bound a binding's text declares, or the default. */
export function verifyStepsOf(bindingText: string | null): number {
  const match = bindingText === null ? null : VERIFY_STEPS.exec(bindingText);
  return match?.[1] === undefined ? DEFAULT_VERIFY_STEPS : Number(match[1]);
}

/** The deadline a binding's text declares, or the default. */
export function verifyTimeoutOf(bindingText: string | null): number {
  const match =
    bindingText === null ? null : VERIFY_TIMEOUT_MS.exec(bindingText);
  return match?.[1] === undefined
    ? DEFAULT_VERIFY_TIMEOUT_MS
    : Number(match[1].replaceAll('_', ''));
}

export function modelEncodingOf(
  bindingText: string | null
): 'fun-arrays' | undefined {
  return bindingText !== null && ENCODING.test(bindingText)
    ? 'fun-arrays'
    : undefined;
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
export function modelVerifications(
  pkg: Pick<SpecPackage, 'dir' | 'models'>
): readonly ModelVerify[] {
  const texts = bindingTexts(pkg.dir);
  return modelVerificationsFromBindings(pkg.models, texts);
}

export function modelVerificationsFromBindings(
  models: readonly string[],
  texts: ReadonlyMap<string, string>
): readonly ModelVerify[] {
  return models
    .map((specUri): ModelVerify => {
      const stem = specUri.replace(/^.*\//, '').replace(/\.qnt$/, '');
      const binding = texts.get(stem) ?? null;
      const encoding = modelEncodingOf(binding);
      const invariantMode =
        binding === null ? undefined : INVARIANT_MODE.exec(binding)?.[1];
      const groupSize =
        binding === null
          ? undefined
          : INDUCTION_CASE_GROUP_SIZE.exec(binding)?.[1];
      const boundedGroupSize =
        binding === null
          ? undefined
          : BOUNDED_INVARIANT_GROUP_SIZE.exec(binding)?.[1];
      return {
        specUri,
        steps: verifyStepsOf(binding),
        timeoutMs: verifyTimeoutOf(binding),
        inductiveInvariant:
          binding === null
            ? null
            : (INDUCTIVE_INVARIANT.exec(binding)?.[1] ?? null),
        ...(encoding === undefined ? {} : { encoding }),
        ...(invariantMode === 'before' || invariantMode === 'after'
          ? { invariantMode }
          : {}),
        ...(groupSize === undefined
          ? {}
          : { inductionCaseGroupSize: Number(groupSize) }),
        ...(boundedGroupSize === undefined
          ? {}
          : { boundedInvariantGroupSize: Number(boundedGroupSize) }),
        ...(binding !== null && CONCRETE_TYPES.test(binding)
          ? { inferPolymorphicTypes: false as const }
          : {}),
        ...(binding !== null && SHORT_CIRCUIT.test(binding)
          ? { shortCircuit: true as const }
          : {}),
        ...(binding !== null && SEPARATE_INDUCTION.test(binding)
          ? { separateInduction: true as const }
          : {}),
      };
    })
    .sort((a, b) => a.specUri.localeCompare(b.specUri));
}

export type ModelPart = { readonly index: number; readonly count: number };

/** `--part k/n`, or `null` when the flag is absent. */
export function modelPartOf(argv: readonly string[]): ModelPart | null {
  const at = argv.indexOf('--part');
  if (at < 0) return null;
  const match = /^(\d+)\/(\d+)$/.exec(argv[at + 1] ?? '');
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (match === null || count < 1 || index >= count)
    throw new Error(
      `verify-models: --part wants k/n with 0 <= k < n, got ${String(argv[at + 1])}`
    );
  return { index, count };
}

/**
 * `--phase k/n` or `--phase a,b-c/n`, or `null` for every proof phase.
 * The count is the model's phase count, so a new case cannot be skipped.
 */
export function modelPhaseOf(argv: readonly string[]): PhaseArg | null {
  const at = argv.indexOf('--phase');
  if (at < 0) return null;
  const parsed = parsePhaseArg(argv[at + 1] ?? '');
  if (parsed === null)
    throw new Error(
      `verify-models: --phase wants k/n or a,b-c/n with every index in range, got ${String(argv[at + 1])}`
    );
  return parsed;
}

/** The verifications of one part: every `count`-th from `index`, in path order. */
export function modelPartVerifications(
  verifications: readonly ModelVerify[],
  part: ModelPart | null
): readonly ModelVerify[] {
  return part === null
    ? verifications
    : verifications.filter(
        (_, position) => position % part.count === part.index
      );
}

type Verdict = {
  readonly verify: ModelVerify;
  readonly ok: boolean;
  readonly detail: string;
};

/** Where one package's run writes, and the name its evidence carries. */
type Run = {
  readonly reportDir: string;
  readonly packageName: string;
  /** Set when this task proves a share of the phases and must not erase the others. */
  readonly phase: PhaseArg | null;
};

function record(
  run: Run,
  verify: ModelVerify,
  text: string,
  obligations: readonly {
    readonly id: string;
    readonly status: 'pass' | 'fail';
    readonly detail: string;
  }[]
): void {
  recordEvidence(run.reportDir, {
    specUri: verify.specUri,
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

async function runVerify(run: Run, verify: ModelVerify): Promise<Verdict> {
  const specPath = join(REPO_ROOT, verify.specUri);
  const text = readFileSync(specPath, 'utf8');
  const shape = modelShapeIssues(text, verify.specUri).map((found) =>
    formatModelShapeIssue(verify.specUri, found)
  );
  if (shape.length > 0) {
    const detail = shape.join('\n');
    record(run, verify, text, [{ id: 'shape', status: 'fail', detail }]);
    console.log(`FAIL ${verify.specUri} · shape`);
    return { verify, ok: false, detail };
  }
  return verifyModel(run, verify, text);
}

async function verifyModel(
  run: Run,
  verify: ModelVerify,
  text: string
): Promise<Verdict> {
  const specPath = join(REPO_ROOT, verify.specUri);
  const invariants = modelInvariants(text);
  const properties = modelTemporalProperties(text);
  const outName = verify.specUri.replace(/\W+/g, '-');
  const result = await withSolverSlot(
    (): Promise<TemporalResult | VerifyResult> =>
      properties.length > 0
        ? verifyTemporal({
            specPath,
            properties,
            invariants,
            outDir: join(run.reportDir, 'tlc', outName),
            timeoutMs: verify.timeoutMs,
          })
        : quintVerify({
            specPath,
            invariants,
            maxSteps: verify.steps,
            ...solverStrategy(verify),
            ...(run.phase === null ? {} : { phase: run.phase }),
            outDir: join(run.reportDir, 'apalache', outName),
            timeoutMs: verify.timeoutMs,
          })
  );
  const strategy = modelStrategy(verify, properties);
  const states =
    result.ok && 'statesExplored' in result && 'searchDepth' in result
      ? ` (${result.statesExplored} distinct states; graph search depth ${result.searchDepth})`
      : '';
  const proved =
    result.ok && 'invariants' in result ? result.invariants : invariants;
  const detail = result.ok
    ? `${proved.join(', ')} hold by ${strategy}${states}`
    : result.output;
  const verifyId =
    run.phase === null ? 'verify' : `verify:${run.phase.indexes.join('.')}`;
  record(run, verify, text, [
    { id: 'shape', status: 'pass', detail: 'valid aggregate shape' },
    { id: verifyId, status: result.ok ? 'pass' : 'fail', detail },
    ...properties.map((property) => ({
      id: `temporal:${property}`,
      status: result.ok ? ('pass' as const) : ('fail' as const),
      detail: result.ok
        ? `TLC verified ${property} across the ${strategy}${states}`
        : result.output,
    })),
  ]);
  const took = result.ok ? ` (${(result.durationMs / 1000).toFixed(1)} s)` : '';
  console.log(
    `${result.ok ? 'ok  ' : 'FAIL'} ${verify.specUri} · ${strategy}${states}${took}`
  );
  return { verify, ok: result.ok, detail };
}

function solverStrategy(verify: ModelVerify) {
  return {
    ...(verify.encoding === undefined ? {} : { encoding: verify.encoding }),
    ...(verify.invariantMode === undefined
      ? {}
      : { invariantMode: verify.invariantMode }),
    ...(verify.shortCircuit === undefined
      ? {}
      : { shortCircuit: verify.shortCircuit }),
    ...(verify.separateInduction === true ? { separateInduction: true } : {}),
    ...(verify.inductionCaseGroupSize === undefined
      ? {}
      : { inductionCaseGroupSize: verify.inductionCaseGroupSize }),
    ...(verify.boundedInvariantGroupSize === undefined
      ? {}
      : { boundedInvariantGroupSize: verify.boundedInvariantGroupSize }),
    ...(verify.inferPolymorphicTypes === undefined
      ? {}
      : { inferPolymorphicTypes: verify.inferPolymorphicTypes }),
    ...(verify.inductiveInvariant === null
      ? {}
      : { inductiveInvariant: verify.inductiveInvariant }),
  };
}

function modelStrategy(
  verify: ModelVerify,
  properties: readonly string[]
): string {
  if (properties.length > 0) return 'complete finite graph, including cycles';
  if (verify.inductiveInvariant === null)
    return `every state within ${verify.steps} steps`;
  return `induction through ${verify.inductiveInvariant}: initial states, preservation, and implication`;
}

async function runAll(
  run: Run,
  verifications: readonly ModelVerify[]
): Promise<readonly Verdict[]> {
  const verdicts: Verdict[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let index = next++; index < verifications.length; index = next++) {
      const verify = verifications[index];
      if (verify !== undefined) verdicts.push(await runVerify(run, verify));
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
      `verify-models: ${dir} runs no Quint models — run it from a package's verify:models`
    );
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const part = modelPartOf(args);
  const phase = modelPhaseOf(args);
  const verifications = modelPartVerifications(modelVerifications(pkg), part);
  if (verifications.length === 0) {
    console.error(
      `verify-models: ${dir} has no model in part ${String(part?.index)}/${String(part?.count)} — lower modelParts`
    );
    process.exit(1);
  }
  const verdicts = await withModelWorkspace(
    join(REPO_ROOT, dir),
    (reportDir) =>
      runAll(
        { reportDir, packageName: `${pkg.name}#verify:models`, phase },
        verifications
      ),
    verifications.map((verify) => verify.specUri),
    phase !== null
  );
  const failed = verdicts.filter((verdict) => !verdict.ok);
  if (failed.length > 0) {
    console.error(
      `${pkg.name} models verify failed:\n${failed
        .map(
          (verdict) =>
            `  ${verdict.verify.specUri}:\n    ${verdict.detail.replace(/\n/g, '\n    ')}`
        )
        .join('\n')}`
    );
    process.exit(1);
  }
  console.log(
    `ok: ${String(verifications.length)} Quint models model-verified (${join(dir, REPORT_DIR)})`
  );
}
