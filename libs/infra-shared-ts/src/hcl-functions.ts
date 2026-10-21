/**
 * The OpenTofu built-in functions this configuration (and a reasonable
 * neighbourhood of it) uses. A function over an unknown argument is unknown;
 * the few that are not (`nonsensitive`, `length` of a known list) say so.
 */

import type { Value } from './hcl-value';
import {
  compareText,
  containsUnknown,
  EvalError,
  isList,
  isObject,
  isUnknown,
  sortedKeys,
  stringify,
  UNKNOWN,
} from './hcl-value';
import type { SourceFiles } from './infra-source';

type Fn = (args: readonly Value[], files: SourceFiles) => Value;

const str = (value: Value | undefined): string => stringify(value ?? null);

function listOf(value: Value | undefined): readonly Value[] {
  if (value !== undefined && isList(value)) return value;
  throw new EvalError('expected a list');
}

function objectOf(value: Value | undefined): { [key: string]: Value } {
  if (value !== undefined && isObject(value)) {
    return value as { [key: string]: Value };
  }
  throw new EvalError('expected an object');
}

function regexFrom(pattern: string): RegExp {
  const flags = pattern.startsWith('(?i)') ? 'i' : '';
  return new RegExp(pattern.replace(/^\(\?i\)/, ''), flags);
}

function replace(args: readonly Value[]): Value {
  const [text, search, replacement] = args.map(str) as [string, string, string];
  if (search.length > 1 && search.startsWith('/') && search.endsWith('/')) {
    return text.replace(regexFrom(search.slice(1, -1)), replacement);
  }
  return text.split(search).join(replacement);
}

function toSet(args: readonly Value[]): Value {
  const seen = new Set<string>();
  const out: Value[] = [];
  for (const item of listOf(args[0])) {
    const key = isUnknown(item) ? Symbol() : JSON.stringify(item);
    if (typeof key === 'string') {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(item);
  }
  return out.sort((a, b) => compareText(str(a), str(b)));
}

function merge(args: readonly Value[]): Value {
  const out: Record<string, Value> = {};
  for (const arg of args) {
    if (arg === null) continue;
    const source = objectOf(arg);
    for (const key of Object.keys(source)) {
      Object.defineProperty(out, key, {
        enumerable: true,
        configurable: true,
        get: () => source[key] as Value,
      });
    }
  }
  return out;
}

function lookup(args: readonly Value[]): Value {
  const found = (objectOf(args[0]) as Record<string, Value>)[str(args[1])];
  if (found !== undefined) return found;
  if (args.length > 2) return args[2] as Value;
  throw new EvalError('no such key');
}

function jsonDecode(args: readonly Value[]): Value {
  return JSON.parse(str(args[0])) as Value;
}

function fileFn(args: readonly Value[], files: SourceFiles): Value {
  const text = files.read(str(args[0]));
  if (text === undefined) throw new EvalError(`no such file ${str(args[0])}`);
  return text;
}

function trimPrefixSuffix(
  args: readonly Value[],
  edge: 'prefix' | 'suffix'
): Value {
  const [text, affix] = args.map(str) as [string, string];
  if (affix === '') return text;
  if (edge === 'suffix') {
    return text.endsWith(affix) ? text.slice(0, -affix.length) : text;
  }
  return text.startsWith(affix) ? text.slice(affix.length) : text;
}

function regex(args: readonly Value[]): Value {
  const match = regexFrom(str(args[0])).exec(str(args[1]));
  if (match === null) throw new EvalError('regex did not match');
  const groups = match.slice(1);
  if (groups.length === 0) return match[0] as string;
  return groups.map((g) => g ?? null);
}

function formatFn(args: readonly Value[]): Value {
  let index = 1;
  return str(args[0]).replace(/%[sdv%]/g, (token) => {
    if (token === '%%') return '%';
    const value = args[index] as Value;
    index += 1;
    return stringify(value);
  });
}

function flatten(args: readonly Value[]): Value {
  const out: Value[] = [];
  for (const item of listOf(args[0])) {
    if (isList(item)) out.push(...(flatten([item]) as readonly Value[]));
    else out.push(item);
  }
  return out;
}

const FUNCTIONS: Readonly<Record<string, Fn>> = {
  jsondecode: jsonDecode,
  file: fileFn,
  fileset: ([dir, pattern], files) => [
    ...files.fileset(str(dir), str(pattern)),
  ],
  replace,
  trimsuffix: (args) => trimPrefixSuffix(args, 'suffix'),
  trimprefix: (args) => trimPrefixSuffix(args, 'prefix'),
  trimspace: ([s]) => str(s).trim(),
  tostring: ([v]) => str(v),
  tonumber: ([v]) => Number(str(v)),
  tobool: ([v]) => str(v) === 'true',
  toset: toSet,
  tolist: ([v]) => [...listOf(v)],
  tomap: ([v]) => objectOf(v),
  keys: ([v]) => sortedKeys(objectOf(v)),
  values: ([v]) => {
    const obj = objectOf(v) as Record<string, Value>;
    return sortedKeys(obj).map((k) => obj[k] as Value);
  },
  length: ([v]) => {
    if (typeof v === 'string') return v.length;
    if (v !== undefined && isList(v)) return v.length;
    return Object.keys(objectOf(v)).length;
  },
  contains: ([list, item]) =>
    listOf(list).some(
      (entry) => JSON.stringify(entry) === JSON.stringify(item)
    ),
  merge: (args) => merge(args),
  lookup: (args) => lookup(args),
  concat: (args) => args.flatMap((a) => listOf(a)),
  flatten: (args) => flatten(args),
  distinct: (args) => toSet(args),
  sort: ([v]) => [...listOf(v)].map(str).sort(),
  join: ([sep, list]) => listOf(list).map(str).join(str(sep)),
  split: ([sep, text]) => str(text).split(str(sep)),
  lower: ([v]) => str(v).toLowerCase(),
  upper: ([v]) => str(v).toUpperCase(),
  format: formatFn,
  regex,
  urlencode: ([v]) => encodeURIComponent(str(v)),
  jsonencode: ([v]) => {
    if (v !== undefined && containsUnknown(v)) return UNKNOWN;
    return JSON.stringify(v);
  },
  nonsensitive: ([v]) => v as Value,
  sensitive: ([v]) => v as Value,
  alltrue: ([v]) => listOf(v).every((x) => x === true),
  anytrue: ([v]) => listOf(v).some((x) => x === true),
  coalesce: (args) => args.find((a) => a !== null && a !== '') ?? null,
  element: ([list, index]) => {
    const items = listOf(list);
    return items[Number(index) % items.length] as Value;
  },
  max: (args) => Math.max(...args.map(Number)),
  min: (args) => Math.min(...args.map(Number)),
  parseint: ([v, base]) => Number.parseInt(str(v), Number(base ?? 10)),
  templatefile: () => UNKNOWN,
  plantimestamp: () => UNKNOWN,
  timestamp: () => UNKNOWN,
  formatdate: () => UNKNOWN,
  sha256: () => UNKNOWN,
  base64sha256: () => UNKNOWN,
  uuid: () => UNKNOWN,
  can: ([v]) => !isUnknown(v as Value),
};

/** Functions that are known even when an argument is unknown. */
const TOLERANT = new Set(['nonsensitive', 'sensitive', 'length', 'keys']);

export function callFunction(
  name: string,
  args: readonly Value[],
  files: SourceFiles
): Value {
  const fn = FUNCTIONS[name];
  if (fn === undefined) return UNKNOWN;
  if (!TOLERANT.has(name) && args.some(isUnknown)) return UNKNOWN;
  return fn(args, files);
}
