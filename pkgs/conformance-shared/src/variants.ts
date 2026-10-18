/**
 * What a host requires of the specs it runs once per variant (a game, say):
 * every variant it has, and for each spec the variants that must each have
 * a verdict of their own. The host writes it beside its evidence
 * (`<reportDir>/variants/`), derived from the same plan that decides what
 * it runs, so the report can tell a variant a spec does not need (not
 * applicable) from one it needs and has no verdict for (required but
 * missing) — one variant's verdict never stands for another's.
 */

export type VariantRequirements = {
  /** The package whose runner holds its specs to these variants. */
  readonly packageName: string;
  /** Every variant the host has, needed by a spec or not. */
  readonly variants: readonly string[];
  /** Repo-relative spec path → the variants it is required to run for. */
  readonly required: Readonly<Record<string, readonly string[]>>;
};

const isStrings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function isVariantRequirements(
  value: unknown
): value is VariantRequirements {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  const required = record['required'];
  return (
    typeof record['packageName'] === 'string' &&
    isStrings(record['variants']) &&
    typeof required === 'object' &&
    required !== null &&
    !Array.isArray(required) &&
    Object.values(required).every(isStrings)
  );
}

/** One spec's requirement: the variants it needs among every variant there is. */
export type SpecVariants = {
  readonly required: readonly string[];
  readonly variants: readonly string[];
};

/**
 * Every spec's requirement from several hosts' (or buckets') declarations:
 * a spec needs every variant any of them requires of it.
 */
export function specVariants(
  declarations: readonly VariantRequirements[]
): ReadonlyMap<string, SpecVariants> {
  const required = new Map<string, Set<string>>();
  const variants = new Map<string, Set<string>>();
  for (const declaration of declarations)
    for (const [spec, ids] of Object.entries(declaration.required)) {
      const needs = required.get(spec) ?? new Set<string>();
      const known = variants.get(spec) ?? new Set<string>();
      for (const id of ids) needs.add(id);
      for (const id of [...declaration.variants, ...ids]) known.add(id);
      required.set(spec, needs);
      variants.set(spec, known);
    }
  return new Map(
    [...required].map(([spec, needs]) => [
      spec,
      {
        required: [...needs].sort(),
        variants: [...(variants.get(spec) ?? [])].sort(),
      },
    ])
  );
}
