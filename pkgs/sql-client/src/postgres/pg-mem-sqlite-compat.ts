/**
 * SQLite JSON1-shaped functions for [pg-mem](https://github.com/oguimbal/pg-mem).
 *
 * pg-mem does not run real PL/pgSQL, so {@link installPostgresSqliteCompat}'s
 * SQL DDL would install no-op bodies. Register JS implementations instead.
 *
 * Lives here (not `@pkgs/postgres-sqlite-compat`) so that package stays a
 * leaf and does not pull `pg-mem` into real-Postgres consumers.
 */

import { DataType, type IMemoryDb, type ISchema } from 'pg-mem';

export type InstallPgMemSqliteCompatOptions = {
  readonly mem: IMemoryDb;
};

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { readonly [key: string]: Json };

function parseJson(text: string | null | undefined): Json | undefined {
  if (text == null) return undefined;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}

function atomText(v: Json | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function sqliteType(v: Json | undefined): string | null {
  if (v === undefined) return null;
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  if (typeof v === 'string') return 'text';
  if (typeof v === 'number') return 'real';
  if (typeof v === 'boolean') return 'true';
  return null;
}

/** Convert SQLite JSON path (`$.a.b[0]`) into a key/index list. */
function pathToSegments(path: string | null | undefined): string[] {
  const cleaned = String(path ?? '')
    .replace(/^\$/, '')
    .replace(/\[(\d+)\]/g, '.$1');
  return cleaned.split('.').filter((s) => s.length > 0);
}

function getAtPath(
  root: Json,
  path: string | null | undefined
): Json | undefined {
  let cur: Json | undefined = root;
  for (const seg of pathToSegments(path)) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      cur = cur[Number(seg)];
      continue;
    }
    if (typeof cur === 'object') {
      cur = (cur as Record<string, Json>)[seg];
      continue;
    }
    return undefined;
  }
  return cur;
}

function ensureChild(
  parent: Json,
  seg: string,
  nextIsIndex: boolean
): Json | undefined {
  if (Array.isArray(parent)) {
    const idx = Number(seg);
    if (parent[idx] == null) parent[idx] = nextIsIndex ? [] : {};
    return parent[idx];
  }
  if (typeof parent === 'object' && parent !== null) {
    const obj = parent as Record<string, Json>;
    if (obj[seg] == null) obj[seg] = nextIsIndex ? [] : {};
    return obj[seg];
  }
  return undefined;
}

function assignLeaf(parent: Json, last: string, value: Json): void {
  if (Array.isArray(parent)) {
    parent[Number(last)] = value;
  } else if (typeof parent === 'object' && parent !== null) {
    (parent as Record<string, Json>)[last] = value;
  }
}

function setAtPath(
  root: Json,
  path: string | null | undefined,
  value: Json,
  mode: 'set' | 'insert' | 'replace'
): Json {
  const segments = pathToSegments(path);
  if (segments.length === 0) return root;
  const existing = getAtPath(root, path);
  if (mode === 'insert' && existing !== undefined) return root;
  if (mode === 'replace' && existing === undefined) return root;

  const clone = structuredClone(root) as Json;
  let cur: Json = clone;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next = ensureChild(cur, segments[i]!, /^\d+$/.test(segments[i + 1]!));
    if (next === undefined) return root;
    cur = next;
  }
  assignLeaf(cur, segments[segments.length - 1]!, value);
  return clone;
}

function removeAtPath(root: Json, path: string | null | undefined): Json {
  const segments = pathToSegments(path);
  if (segments.length === 0) return root;
  const clone = structuredClone(root) as Json;
  let cur: Json = clone;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i]!;
    if (Array.isArray(cur)) cur = cur[Number(seg)] as Json;
    else if (typeof cur === 'object' && cur !== null) {
      cur = (cur as Record<string, Json>)[seg] as Json;
    } else return root;
    if (cur == null) return clone;
  }
  const last = segments[segments.length - 1]!;
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (Number.isInteger(idx) && idx >= 0 && idx < cur.length) {
      cur.splice(idx, 1);
    }
  } else if (typeof cur === 'object' && cur !== null) {
    delete (cur as Record<string, Json>)[last];
  }
  return clone;
}

function parseValueArg(raw: string | null | undefined): Json {
  if (raw == null) return null;
  const parsed = parseJson(raw);
  return parsed === undefined ? raw : parsed;
}

function mutateJsonText(
  text: string | null,
  path: string | null,
  value: string | null | undefined,
  mode: 'set' | 'insert' | 'replace' | 'remove'
): string | null {
  if (text == null) return null;
  const root = parseJson(text);
  if (root === undefined) return text;
  try {
    if (mode === 'remove') return JSON.stringify(removeAtPath(root, path));
    return JSON.stringify(setAtPath(root, path, parseValueArg(value), mode));
  } catch {
    return text;
  }
}

function registerReadFns(schema: ISchema): void {
  schema.registerFunction({
    name: 'json_valid',
    args: [DataType.text],
    returns: DataType.bool,
    implementation: (text: string | null) => parseJson(text) !== undefined,
  });
  schema.registerFunction({
    name: 'json_type',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (text: string | null, path: string | null) => {
      const root = parseJson(text);
      return root === undefined
        ? null
        : sqliteType(getAtPath(root, path ?? '$'));
    },
  });
  schema.registerFunction({
    name: 'json_type',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (text: string | null) => {
      const root = parseJson(text);
      return root === undefined ? null : sqliteType(root);
    },
  });
  schema.registerFunction({
    name: 'json_array_length',
    args: [DataType.text, DataType.text],
    returns: DataType.integer,
    implementation: (text: string | null, path: string | null) => {
      const root = parseJson(text);
      if (root === undefined) return null;
      const v = getAtPath(root, path == null || path === '' ? '$' : path);
      return Array.isArray(v) ? v.length : null;
    },
  });
  schema.registerFunction({
    name: 'json_array_length',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (text: string | null) => {
      const root = parseJson(text);
      return Array.isArray(root) ? root.length : null;
    },
  });
  schema.registerFunction({
    name: 'json_extract',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (text: string | null, path: string | null) => {
      if (text == null || path == null) return null;
      const root = parseJson(text);
      return root === undefined ? null : atomText(getAtPath(root, path));
    },
  });
  schema.registerFunction({
    name: 'json_quote',
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value: string | null) => JSON.stringify(value),
  });
}

function registerWriteFns(schema: ISchema): void {
  schema.registerFunction({
    name: 'json_set',
    args: [DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (
      text: string | null,
      path: string | null,
      value: string | null
    ) => mutateJsonText(text, path, value, 'set'),
  });
  schema.registerFunction({
    name: 'json_insert',
    args: [DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (
      text: string | null,
      path: string | null,
      value: string | null
    ) => mutateJsonText(text, path, value, 'insert'),
  });
  schema.registerFunction({
    name: 'json_replace',
    args: [DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (
      text: string | null,
      path: string | null,
      value: string | null
    ) => mutateJsonText(text, path, value, 'replace'),
  });
  schema.registerFunction({
    name: 'json_remove',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (text: string | null, path: string | null) =>
      mutateJsonText(text, path, undefined, 'remove'),
  });
  schema.registerFunction({
    name: 'json_patch',
    args: [DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (target: string | null, patch: string | null) => {
      if (target == null || patch == null) return null;
      const a = parseJson(target);
      const b = parseJson(patch);
      if (a === undefined || b === undefined) return null;
      if (
        typeof a === 'object' &&
        a !== null &&
        !Array.isArray(a) &&
        typeof b === 'object' &&
        b !== null &&
        !Array.isArray(b)
      ) {
        return JSON.stringify({ ...a, ...b });
      }
      return JSON.stringify(b);
    },
  });
}

/**
 * Register SQLite JSON1 function names on a pg-mem database.
 * Idempotent for a fresh `newDb()`; safe to call once at create time.
 */
export function installPgMemSqliteCompat(
  opts: InstallPgMemSqliteCompatOptions
): void {
  const schema = opts.mem.public;
  registerReadFns(schema);
  registerWriteFns(schema);
}
