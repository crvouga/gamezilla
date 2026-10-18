/**
 * Per-variant evidence: a spec its host runs once per variant (a shared game
 * specification, once per game) is decided per variant cell, each by its own
 * verdict — `scenario:<scenario> [<variant>]` for a feature, any obligation
 * `… [<variant>]` of the layer for a model, whose traces are dealt out among
 * the variants. Which variants a spec needs is what its host declared
 * (`@pkgs/conformance-shared/variants`), never inferred from the evidence, so
 * one variant's verdict never stands for another's.
 *
 * A cell is `passed`, `failed`, `stale` (its only verdict is from another
 * text of the spec), `required but missing` (no verdict at all), or
 * `not applicable` (a variant the spec does not need). Pure.
 */

import type {
  Layer,
  Obligation,
  SpecKind,
} from '@pkgs/conformance-shared/evidence';
import type { SpecVariants } from '@pkgs/conformance-shared/variants';

export const key = (layer: Layer, id: string): string => `${layer}\n${id}`;

/** What one spec's evidence says, by `key`. */
export type VariantEvidence = {
  /** Null when nothing is fresh. */
  readonly fresh: ReadonlyMap<string, Obligation> | null;
  /** Every obligation recorded only from another text of the spec. */
  readonly staleIds: ReadonlySet<string>;
};

export const VARIANT_STATUSES = [
  'passed',
  'failed',
  'stale',
  'required but missing',
  'not applicable',
] as const;
export type VariantStatus = (typeof VARIANT_STATUSES)[number];

export type VariantCell = {
  readonly spec: string;
  readonly variant: string;
  readonly status: VariantStatus;
};

/** The layer a kind's per-variant runs record, or null when it runs once. */
export function variantLayer(kind: SpecKind): Layer | null {
  if (kind === 'behavior') return 'system';
  if (kind === 'dynamics') return 'implementation';
  return null;
}

const tagged = (id: string, variant: string): boolean =>
  id.endsWith(` [${variant}]`);

/** One verdict a variant needs: what it is called, and how it is found. */
type Need = {
  readonly what: string;
  readonly matches: (k: string) => boolean;
};

/**
 * What `variant` needs: a verdict for every scenario of a feature, or any
 * verdict of the layer for a model.
 */
function needsOf(
  layer: Layer,
  scenarios: readonly string[] | null,
  variant: string
): readonly Need[] {
  if (scenarios === null)
    return [
      {
        what: `no ${layer} verdict`,
        matches: (k) => k.startsWith(`${layer}\n`) && tagged(k, variant),
      },
    ];
  return scenarios.map((name) => {
    const want = key(layer, `scenario:${name} [${variant}]`);
    return {
      what: `scenario "${name}" has no ${layer} verdict`,
      matches: (k) => k === want,
    };
  });
}

type Judged = {
  readonly status: Exclude<VariantStatus, 'not applicable'>;
  readonly problems: readonly string[];
};

function judge(
  path: string,
  evidence: VariantEvidence | undefined,
  needs: readonly Need[],
  variant: string
): Judged {
  const fresh = [...(evidence?.fresh?.entries() ?? [])];
  const stale = [...(evidence?.staleIds ?? [])];
  let failed = false;
  const staleProblems: string[] = [];
  const missing: string[] = [];
  for (const need of needs) {
    const found = fresh.filter(([k]) => need.matches(k));
    if (found.some(([, obligation]) => obligation.status === 'fail'))
      failed = true;
    if (found.length > 0) continue;
    if (stale.some(need.matches))
      staleProblems.push(
        `${path}: stale evidence for ${variant} — ${need.what} from the current text, only from another; run its suite again`
      );
    else
      missing.push(
        `${path}: required but missing for ${variant} — ${need.what}`
      );
  }
  const problems = [...staleProblems, ...missing];
  if (failed) return { status: 'failed', problems };
  if (staleProblems.length > 0) return { status: 'stale', problems };
  if (missing.length > 0) return { status: 'required but missing', problems };
  return { status: 'passed', problems };
}

/**
 * Every problem of a varied spec's required cells: stale and missing
 * verdicts, each naming its variant. (A failing verdict is reported with
 * the spec's other failures.) A spec requiring no variant proves nothing.
 */
export function variantProblems(input: {
  readonly path: string;
  readonly layer: Layer;
  /** A feature's scenarios; null for a model. */
  readonly scenarios: readonly string[] | null;
  readonly evidence: VariantEvidence | undefined;
  readonly requirement: SpecVariants;
}): readonly string[] {
  const { path, layer, scenarios, evidence, requirement } = input;
  if (requirement.required.length === 0)
    return [
      `${path}: its host requires no variant to run it — nothing proves it`,
    ];
  return requirement.required.flatMap(
    (variant) =>
      judge(path, evidence, needsOf(layer, scenarios, variant), variant)
        .problems
  );
}

/** Every cell of a varied spec: each variant there is, judged or not applicable. */
export function variantCells(input: {
  readonly path: string;
  readonly kind: SpecKind;
  readonly scenarios: readonly string[];
  readonly evidence: VariantEvidence | undefined;
  readonly requirement: SpecVariants;
}): readonly VariantCell[] {
  const layer = variantLayer(input.kind);
  if (layer === null) return [];
  const scenarios = input.kind === 'behavior' ? input.scenarios : null;
  return input.requirement.variants.map((variant) => ({
    spec: input.path,
    variant,
    status: input.requirement.required.includes(variant)
      ? judge(
          input.path,
          input.evidence,
          needsOf(layer, scenarios, variant),
          variant
        ).status
      : 'not applicable',
  }));
}

/** How many cells have each status, for the job log. */
export function variantSummary(cells: readonly VariantCell[]): string {
  return VARIANT_STATUSES.map(
    (status) =>
      `${String(cells.filter((cell) => cell.status === status).length)} ${status}`
  ).join(' · ');
}
