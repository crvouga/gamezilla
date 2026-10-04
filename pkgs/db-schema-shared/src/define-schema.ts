import {
  parseIndexesLiteral,
  parseRetiredColumnsLiteral,
  parseRetiredTablesLiteral,
  parseTablesLiteral,
} from './parse-schema-literal';
import { assertSnakeCaseIdent } from './snake-case';
import { buildSnapshot } from './snapshot';
import type {
  DeclaredColumn,
  ReadonlyDeclaredSchema,
  Schema,
  Snapshot,
} from './types';
import type { SchemaInput } from './validate-schema-types';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'tables',
  'indexes',
  'uniqueIndexes',
  'retiredColumns',
  'retiredTables',
]);

function assertKnownTopLevelKeys(literal: Record<string, unknown>): void {
  for (const key of Object.keys(literal)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(`unknown top-level key '${key}'`);
    }
  }
}

export type TableNamePolicy = {
  /**
   * Domain ids. Each table must equal a domain or start with `{domain}_`.
   * Example: domains `['auth','spaces']` allows `auth`, `auth_users`, `spaces`.
   */
  readonly domains: readonly string[];
};

export type DefineSchemaOptions = {
  readonly tableNamePolicy?: TableNamePolicy;
};

function assertMatchesTableNamePolicy(
  tableName: string,
  domains: readonly string[]
): void {
  if (domains.length === 0) {
    throw new Error('tableNamePolicy.domains: must be a non-empty array');
  }
  for (const domain of domains) {
    if (typeof domain !== 'string' || domain.length === 0) {
      throw new Error('tableNamePolicy.domains: each domain must be a string');
    }
    assertSnakeCaseIdent(domain, `tableNamePolicy.domains`);
  }
  const ok = domains.some(
    (d) => tableName === d || tableName.startsWith(`${d}_`)
  );
  if (!ok) {
    throw new Error(
      `tables.${tableName}: must equal or start with one of [${domains.join(', ')}] (got '${tableName}')`
    );
  }
}

function assertAllTablesMatchPolicy(
  tables: Record<string, Record<string, DeclaredColumn>>,
  policy: TableNamePolicy | undefined
): void {
  if (policy === undefined) return;
  for (const tableName of Object.keys(tables)) {
    assertMatchesTableNamePolicy(tableName, policy.domains);
  }
}

export function validateRuntime(
  literal: unknown,
  options?: DefineSchemaOptions
): ReadonlyDeclaredSchema {
  if (!isPlainObject(literal)) {
    throw new Error('schema: must be an object');
  }
  assertKnownTopLevelKeys(literal);
  const tables = parseTablesLiteral(literal['tables']);
  assertAllTablesMatchPolicy(tables, options?.tableNamePolicy);
  const retiredColumns = parseRetiredColumnsLiteral(
    literal['retiredColumns'],
    tables
  );
  const retiredTables = parseRetiredTablesLiteral(
    literal['retiredTables'],
    tables
  );
  const indexCtx = { tables };
  const crossSeen = new Set<string>();
  const indexes = parseIndexesLiteral({
    value: literal['indexes'],
    ctx: indexCtx,
    field: 'indexes',
    unique: false,
    crossSeen,
  });
  const uniqueIndexes = parseIndexesLiteral({
    value: literal['uniqueIndexes'],
    ctx: indexCtx,
    field: 'uniqueIndexes',
    unique: true,
    crossSeen,
  });
  return { tables, indexes, uniqueIndexes, retiredColumns, retiredTables };
}

/** Seal a validated declared schema into an immutable {@link Schema}. */
export function sealSchema(declared: ReadonlyDeclaredSchema): Schema {
  const frozenDeclared = deepFreeze(declared);
  const schema: Schema = {
    snapshot(): Snapshot {
      return buildSnapshot(frozenDeclared);
    },
    _declared: frozenDeclared,
  };
  return deepFreeze(schema);
}

/** @internal Package tests only — product code uses {@link registerTables}. */
export function defineSchema<const T>(
  literal: SchemaInput<T>,
  options?: DefineSchemaOptions
): Schema {
  return sealSchema(validateRuntime(literal, options));
}
