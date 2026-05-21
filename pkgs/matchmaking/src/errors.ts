/**
 * Public, typed error classes thrown by `@pkgs/matchmaking`.
 *
 * Kept in their own module so consumers can `instanceof`-narrow
 * without dragging the whole `Matchmaking` facade into a barrel,
 * and so the public facade file stays under the "one class per file"
 * lint budget.
 */

/**
 * Thrown by the first `Matchmaking.join` call per process when the
 * schema fingerprint stored in `matchmaking_schema_state` does not
 * match the fingerprint of the `MatchmakingSchema` this instance
 * was configured with.
 *
 * What it usually means in production: someone deployed a `migrate()`
 * with a DIFFERENT schema (different `partitionKeys` or different
 * `primaryNumericKey`), then started a second process that still has
 * the old schema. Without this error the second process would
 * silently compute the wrong `partition_signature` and produce zero
 * matches.
 *
 * Recovery: restart the second process with the new schema, or
 * re-`migrate()` from the second process with its configured schema.
 */
export class MatchmakingSchemaDriftError extends Error {
  readonly __matchmaking_schema_drift_error = true as const;

  constructor(
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(
      `Matchmaking: schema drift detected. ` +
        `Configured fingerprint: ${expected}. ` +
        `Database fingerprint: ${actual}. ` +
        `Re-run migrate() with the correct schema, or restart this ` +
        `process with the deployed schema. Refusing to serve to avoid ` +
        `silently producing zero matches.`
    );
    this.name = 'MatchmakingSchemaDriftError';
  }
}
