/**
 * Hard payload limits enforced by the HTTP validator and by join /
 * updateFormulas on every adapter.
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
   * or in a formula `path` field.
   */
  maxStringBytes: 1024,
  /**
   * Maximum byte length of the serialised `metadata` JSON.
   */
  maxMetadataBytes: 1024,
} as const;

/** Minimum `groupSize` (pairwise default). */
export const MATCHMAKING_MIN_GROUP_SIZE = 2;
/** Maximum `groupSize`. */
export const MATCHMAKING_MAX_GROUP_SIZE = 16;
/** Minimum `priority`. */
export const MATCHMAKING_MIN_PRIORITY = -1000;
/** Maximum `priority`. */
export const MATCHMAKING_MAX_PRIORITY = 1000;
