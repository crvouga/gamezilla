/**
 * Capability flags for dialect planners. Tests and planners branch on these
 * flags — never on dialect name strings.
 */
export type DialectCaps = {
  /** Index builds may run outside a transaction (`CREATE INDEX CONCURRENTLY`). */
  readonly concurrentIndexes: boolean;
  /** SQLite cannot ALTER most table shape; rebuild is the physical rewrite. */
  readonly tableRebuild: boolean;
  /** Server: never emit DROP TABLE / DROP COLUMN / ALTER TYPE / RENAME. */
  readonly refuseDestructiveDdl: boolean;
  /** Client: may drop columns that are explicitly retired. */
  readonly dropRetired: boolean;
};

export const POSTGRES_CAPS: DialectCaps = {
  concurrentIndexes: true,
  tableRebuild: false,
  refuseDestructiveDdl: true,
  dropRetired: false,
};

export const SQLITE_CAPS: DialectCaps = {
  concurrentIndexes: false,
  tableRebuild: true,
  refuseDestructiveDdl: false,
  dropRetired: true,
};
