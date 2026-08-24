/**
 * Portable (SQLite-shaped) SQL bans shared by runtime {@link assertAgnosticSql}
 * Application SQL must run on SQLite and on Postgres
 * with `@pkgs/postgres-sqlite-compat` installed — no vendor casts, locks, or
 * engine-only helpers.
 */

export type AgnosticSqlBan = {
  readonly kind: string;
  readonly re: RegExp;
};

/**
 * Patterns that make SQL non-portable across SQLite + Postgres (with JSON1
 * compat). Order does not matter; first match wins at assert time.
 */
export const AGNOSTIC_SQL_BANS: readonly AgnosticSqlBan[] = [
  { kind: '::jsonb cast', re: /::\s*jsonb\b/i },
  { kind: '::timestamptz cast', re: /::\s*timestamptz\b/i },
  { kind: '::uuid cast', re: /::\s*uuid\b/i },
  { kind: '::json cast', re: /::\s*json\b/i },
  { kind: 'jsonb_* function', re: /\bjsonb_[a-z_]+\s*\(/i },
  // Postgres jsonb operators (not SQLite json_extract).
  { kind: 'jsonb -> operator', re: /->>?/ },
  { kind: 'FOR UPDATE', re: /\bFOR\s+UPDATE\b/i },
  { kind: 'SKIP LOCKED', re: /\bSKIP\s+LOCKED\b/i },
  { kind: 'pg_advisory_*', re: /\bpg_advisory_[a-z_]+\s*\(/i },
  { kind: 'hashtext(', re: /\bhashtext\s*\(/i },
  { kind: 'pg_catalog', re: /\bpg_catalog\b/i },
  { kind: 'ILIKE', re: /\bILIKE\b/i },
  { kind: 'DISTINCT ON', re: /\bDISTINCT\s+ON\s*\(/i },
  { kind: 'FILTER (WHERE', re: /\bFILTER\s*\(\s*WHERE\b/i },
  { kind: 'ANY (ARRAY', re: /\bANY\s*\(\s*ARRAY\s*\[/i },
  { kind: 'unnest(', re: /\bunnest\s*\(/i },
  { kind: 'INTERVAL literal', re: /\bINTERVAL\s+'/i },
  { kind: 'date_trunc(', re: /\bdate_trunc\s*\(/i },
  // App SQL uses `?` via @pkgs/sql; bare $1-style is Postgres driver surface.
  { kind: '$n positional param', re: /\$\d+\b/ },
  { kind: 'PRAGMA', re: /\bPRAGMA\b/i },
  { kind: 'strftime(', re: /\bstrftime\s*\(/i },
  { kind: "datetime('now')", re: /datetime\s*\(\s*['"]now['"]\s*\)/i },
  { kind: 'randomblob(', re: /\brandomblob\s*\(/i },
  { kind: 'AUTOINCREMENT', re: /\bAUTOINCREMENT\b/i },
  { kind: 'JSONB type', re: /\bJSONB\b/ },
  { kind: 'TIMESTAMPTZ type', re: /\bTIMESTAMPTZ\b/i },
];

export class NonAgnosticSqlError extends Error {
  readonly kind: string;
  readonly sql: string;

  constructor(args: { readonly kind: string; readonly sql: string }) {
    const snippet =
      args.sql.length > 160 ? `${args.sql.slice(0, 160)}…` : args.sql;
    super(`Non-agnostic SQL (${args.kind}): ${snippet}`);
    this.name = 'NonAgnosticSqlError';
    this.kind = args.kind;
    this.sql = args.sql;
  }
}

/** Throw {@link NonAgnosticSqlError} when `sqlText` matches a ban. */
export function assertAgnosticSql(sqlText: string): void {
  for (const ban of AGNOSTIC_SQL_BANS) {
    if (ban.re.test(sqlText)) {
      throw new NonAgnosticSqlError({ kind: ban.kind, sql: sqlText });
    }
  }
}

/** First matching ban kind, or null when portable. */
export function findAgnosticSqlBan(sqlText: string): string | null {
  for (const ban of AGNOSTIC_SQL_BANS) {
    if (ban.re.test(sqlText)) return ban.kind;
  }
  return null;
}
