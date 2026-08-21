/**
 * SQLite JSON1-shaped functions for `@crvouga/postgres-mem`.
 *
 * Real Postgres installs use PL/pgSQL ({@link installPostgresSqliteCompat}).
 * postgres-mem rejects PL/pgSQL and has no `jsonpath` type, so these are
 * `LANGUAGE sql` shims over `#>` / `jsonb_set` / `jsonb_each`.
 *
 * Public re-export: `@pkgs/postgres-sqlite-compat` → `installPostgresMemSqliteCompat`.
 */

import type { Database } from '@crvouga/postgres-mem';

/** Ordered CREATE FUNCTION statements (helpers before dependents). */
export const POSTGRES_MEM_SQLITE_JSON_INSTALL: readonly string[] = [
  `
CREATE OR REPLACE FUNCTION sqlite_json_atom_text(v jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN v IS NULL THEN NULL
    WHEN jsonb_typeof(v) = 'null' THEN NULL
    WHEN jsonb_typeof(v) = 'string' THEN trim(both '"' from v::text)
    ELSE v::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION sqlite_json_path_to_text_array(p_path text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT array_remove(
    string_to_array(
      regexp_replace(
        regexp_replace(COALESCE(p_path, ''), '^\\$', ''),
        '\\[([0-9]+)\\]',
        ',\\1',
        'g'
      ),
      '.'
    ),
    ''
  )
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_valid(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN false
    ELSE length(p_text::jsonb::text) >= 0
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_type(p_text text, p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE jsonb_typeof(
    CASE
      WHEN p_text IS NULL THEN NULL
      WHEN COALESCE(NULLIF(p_path, ''), '$') = '$' THEN p_text::jsonb
      ELSE p_text::jsonb #> sqlite_json_path_to_text_array(p_path)
    END
  )
    WHEN 'object' THEN 'object'
    WHEN 'array' THEN 'array'
    WHEN 'string' THEN 'text'
    WHEN 'number' THEN 'real'
    WHEN 'boolean' THEN 'true'
    WHEN 'null' THEN 'null'
    ELSE NULL
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_type(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT json_type(p_text, '$')
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_array_length(p_text text, p_path text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN jsonb_typeof(
      CASE
        WHEN p_path IS NULL OR p_path = '' OR p_path = '$' THEN p_text::jsonb
        ELSE p_text::jsonb #> sqlite_json_path_to_text_array(p_path)
      END
    ) <> 'array' THEN NULL
    ELSE jsonb_array_length(
      CASE
        WHEN p_path IS NULL OR p_path = '' OR p_path = '$' THEN p_text::jsonb
        ELSE p_text::jsonb #> sqlite_json_path_to_text_array(p_path)
      END
    )
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_array_length(p_text text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT json_array_length(p_text, NULL::text)
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_extract(p_text text, p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL OR p_path IS NULL THEN NULL
    WHEN p_path = '$' THEN sqlite_json_atom_text(p_text::jsonb)
    ELSE sqlite_json_atom_text(
      p_text::jsonb #> sqlite_json_path_to_text_array(p_path)
    )
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_quote(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT to_jsonb(p_value)::text
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_set(p_text text, p_path text, p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN cardinality(sqlite_json_path_to_text_array(p_path)) = 0
      THEN p_text::jsonb::text
    ELSE jsonb_set(
      p_text::jsonb,
      sqlite_json_path_to_text_array(p_path),
      p_value::jsonb,
      true
    )::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_insert(p_text text, p_path text, p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN cardinality(sqlite_json_path_to_text_array(p_path)) = 0
      THEN p_text::jsonb::text
    WHEN (p_text::jsonb #> sqlite_json_path_to_text_array(p_path)) IS NOT NULL
      THEN p_text::jsonb::text
    ELSE jsonb_set(
      p_text::jsonb,
      sqlite_json_path_to_text_array(p_path),
      p_value::jsonb,
      true
    )::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_replace(p_text text, p_path text, p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN cardinality(sqlite_json_path_to_text_array(p_path)) = 0
      THEN p_text::jsonb::text
    WHEN (p_text::jsonb #> sqlite_json_path_to_text_array(p_path)) IS NULL
      THEN p_text::jsonb::text
    ELSE jsonb_set(
      p_text::jsonb,
      sqlite_json_path_to_text_array(p_path),
      p_value::jsonb,
      false
    )::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_remove(p_text text, p_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    WHEN cardinality(sqlite_json_path_to_text_array(p_path)) = 0
      THEN p_text::jsonb::text
    ELSE (p_text::jsonb #- sqlite_json_path_to_text_array(p_path))::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_patch(p_target text, p_patch text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE
    WHEN p_target IS NULL OR p_patch IS NULL THEN NULL
    ELSE (p_target::jsonb || p_patch::jsonb)::text
  END
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_each(p_text text, p_path text)
RETURNS TABLE (
  key text,
  value text,
  type text,
  atom text,
  id bigint,
  parent bigint,
  fullkey text,
  path text
)
LANGUAGE sql
IMMUTABLE
AS $fn$
  WITH root AS (
    SELECT CASE
      WHEN p_text IS NULL THEN NULL::jsonb
      WHEN COALESCE(NULLIF(p_path, ''), '$') = '$' THEN p_text::jsonb
      ELSE p_text::jsonb #> sqlite_json_path_to_text_array(p_path)
    END AS v,
    COALESCE(NULLIF(p_path, ''), '$') AS v_path
  ),
  arr AS (
    SELECT
      (ordinality - 1)::text AS key,
      el AS el,
      v_path
    FROM root,
      LATERAL jsonb_array_elements(root.v) WITH ORDINALITY AS t(el, ordinality)
    WHERE root.v IS NOT NULL AND jsonb_typeof(root.v) = 'array'
  ),
  obj AS (
    SELECT
      obj_key AS key,
      el AS el,
      v_path
    FROM root,
      LATERAL jsonb_each(root.v) AS t(obj_key, el)
    WHERE root.v IS NOT NULL AND jsonb_typeof(root.v) = 'object'
  ),
  combined AS (
    SELECT * FROM arr
    UNION ALL
    SELECT * FROM obj
  )
  SELECT
    key,
    el::text AS value,
    CASE jsonb_typeof(el)
      WHEN 'object' THEN 'object'
      WHEN 'array' THEN 'array'
      WHEN 'string' THEN 'text'
      WHEN 'number' THEN 'real'
      WHEN 'boolean' THEN 'true'
      WHEN 'null' THEN 'null'
      ELSE jsonb_typeof(el)
    END AS type,
    sqlite_json_atom_text(el) AS atom,
    row_number() OVER ()::bigint AS id,
    0::bigint AS parent,
    CASE
      WHEN key ~ '^[0-9]+$' THEN v_path || '[' || key || ']'
      ELSE v_path || '.' || key
    END AS fullkey,
    v_path AS path
  FROM combined
$fn$
`.trim(),
  `
CREATE OR REPLACE FUNCTION json_each(p_text text)
RETURNS TABLE (
  key text,
  value text,
  type text,
  atom text,
  id bigint,
  parent bigint,
  fullkey text,
  path text
)
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT * FROM json_each(p_text, '$')
$fn$
`.trim(),
];

export type InstallPostgresMemSqliteCompatOptions = {
  readonly db: Database;
};

/**
 * Install SQLite JSON1 function names on a postgres-mem database.
 * Idempotent; call once at create time.
 */
export function installPostgresMemSqliteCompat(
  opts: InstallPostgresMemSqliteCompatOptions
): void {
  for (const statement of POSTGRES_MEM_SQLITE_JSON_INSTALL) {
    opts.db.exec(statement);
  }
}
