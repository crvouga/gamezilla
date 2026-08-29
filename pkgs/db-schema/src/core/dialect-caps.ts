/**
 * Capability flags for dialect planners. Tests and planners branch on these
 * flags — never on dialect name strings.
 */
export type DialectCaps = {
  readonly concurrentIndexes: boolean;
  readonly nativeEnums: boolean;
  readonly nativeArrays: boolean;
  readonly alterAddCheck: boolean;
  readonly alterAddForeignKey: boolean;
  readonly createOrReplaceView: boolean;
  /** SQLite cannot ALTER most table shape; rebuild is the physical rewrite. */
  readonly tableRebuild: boolean;
  /** Server: never emit DROP TABLE / DROP COLUMN / ALTER TYPE / RENAME. */
  readonly refuseDestructiveDdl: boolean;
  /** Client: may drop objects that are explicitly deprecated. */
  readonly dropDeprecated: boolean;
};

export const POSTGRES_CAPS: DialectCaps = {
  concurrentIndexes: true,
  nativeEnums: true,
  nativeArrays: true,
  alterAddCheck: true,
  alterAddForeignKey: true,
  createOrReplaceView: true,
  tableRebuild: false,
  refuseDestructiveDdl: true,
  dropDeprecated: false,
};

export const SQLITE_CAPS: DialectCaps = {
  concurrentIndexes: false,
  nativeEnums: false,
  nativeArrays: false,
  alterAddCheck: false,
  alterAddForeignKey: false,
  createOrReplaceView: false,
  tableRebuild: true,
  refuseDestructiveDdl: false,
  dropDeprecated: true,
};
