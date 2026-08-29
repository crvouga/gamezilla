import { assertDialectSqlShape, type DialectSql } from './dialect-sql';
import { assertSnakeCaseIdent } from './snake-case';
import type { DeclaredView } from './types';

export type ViewDefInput = {
  readonly domain: string;
  readonly name: string;
  readonly sql: DialectSql;
  /** Mark the view deprecated (tombstone; client may drop). */
  readonly deprecated?: string;
};

export type ViewDef = {
  readonly kind: 'view';
  readonly domain: string;
  readonly name: string;
  readonly _view: DeclaredView;
  readonly deprecatedNote?: string;
};

function assertMatchesDomain(name: string, domain: string, path: string): void {
  assertSnakeCaseIdent(domain, `${path}.domain`);
  if (name !== domain && !name.startsWith(`${domain}_`)) {
    throw new Error(
      `${path}: name '${name}' must equal domain '${domain}' or start with '${domain}_'`
    );
  }
}

export function defineView(input: ViewDefInput): ViewDef {
  const path = `defineView(${input.name})`;
  assertSnakeCaseIdent(input.name, `${path}.name`);
  assertMatchesDomain(input.name, input.domain, path);
  const sql = assertDialectSqlShape(input.sql, `${path}.sql`);
  if (input.deprecated !== undefined && input.deprecated.length === 0) {
    throw new Error(`${path}: deprecated note must be non-empty`);
  }
  return Object.freeze({
    kind: 'view' as const,
    domain: input.domain,
    name: input.name,
    _view: Object.freeze({
      domain: input.domain,
      name: input.name,
      sql,
    }),
    ...(input.deprecated !== undefined
      ? { deprecatedNote: input.deprecated }
      : {}),
  });
}
