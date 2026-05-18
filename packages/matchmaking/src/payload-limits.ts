/**
 * Hard payload limits enforced by the HTTP validator (`/join` /
 * `/update-formulas`) and by the JS public methods on `Matchmaker`.
 *
 * They exist to bound the worst case for two things that would
 * otherwise be unbounded:
 *
 *   1. PL/pgSQL CPU per pass: `matchmaking_pair_match` walks
 *      `a_formulas x b_formulas` and inside each pair iterates every
 *      numeric/categorical/partition term. Caps on formula count and
 *      per-formula term count make per-pair cost a constant.
 *   2. JSONB row width on `matchmaking_waiting`: long string values
 *      bloat the hot table without bounded benefit. A 1024-byte cap on
 *      any single string value keeps row width predictable.
 *
 * Exposed (re-exported from `index.ts`) so embedders can surface the
 * same limits in their own client-side validators / API docs / OpenAPI
 * specs and so the limits are documented in one canonical place.
 * Changing them is a deployment decision; tests pin each boundary.
 *
 * Internal module to keep the validator (`app.ts`) and the public
 * facade (`matchmaking.ts`) from dragging each other into a circular
 * import.
 *
 * @internal
 */
export const MATCHMAKING_PAYLOAD_LIMITS = {
  /** Maximum number of top-level keys in `data`. */
  maxDataKeys: 64,
  /** Maximum number of formulas per participant. */
  maxFormulas: 8,
  /**
   * Maximum number of `numeric` + `categorical` + `partition` terms
   * summed across one formula.
   */
  maxTermsPerFormula: 32,
  /**
   * Maximum byte length (UTF-8) of any single string value in `data`
   * or in a formula `path` field. Bound to keep row width predictable.
   */
  maxStringBytes: 1024,
  /**
   * Maximum byte length of the serialised `metadata` JSONB on a join.
   * Held below the waiting-row JSONB budget. (Metadata feature ships
   * in a later phase; the limit lives here from day one so the constant
   * doesn't change later.)
   */
  maxMetadataBytes: 1024,
} as const;
