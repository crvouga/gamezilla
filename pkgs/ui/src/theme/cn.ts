/**
 * Runtime `cn` + `cnStyle` — the dynamic counterpart of the sx-codemod.
 *
 * `cn` merges string classes, `SxProps` objects, arrays, and falsy
 * conditionals into one deduped class string by reusing the codemod static
 * tables (`mapSxRecord`) with real runtime values. `cnStyle` returns the
 * inline-style record for props with no Tailwind equivalent (bailed props,
 * underscore values, uncompilable transforms) via the `sxToCss` runtime.
 *
 * Theme-independent: token utilities (`bg-surface`) resolve through
 * `theme.css` CSS variables, so no theme input is needed. Precedence mirrors
 * `flattenSx` (later entries win) and `mapSxRecord` (background beats
 * backgroundColor/elevation).
 */

import { compileStaticTransform } from '../../codemod/sx-map-effect';
import { mapSxRecord } from '../../codemod/sx-mapping';
import { CSS_VAR_COLORS, cssVarElevation } from './css-vars';
import { flattenSx, type SxInput, type SxProps } from './sx-props';
import { sxToCss } from './sx-to-css';

/** Classname inputs: strings, sx objects, nested arrays, falsy conditionals. */
export type CnInput =
  | string
  | SxProps
  | readonly CnInput[]
  | false
  | null
  | undefined;

type StaticRecord = Record<string, string | number | boolean | null>;

type Collected = {
  readonly strings: readonly string[];
  readonly record: StaticRecord;
  readonly raw: SxProps;
  readonly transformClass: string | undefined;
  readonly transformRaw: SxProps['transform'];
};

function isSxObject(value: unknown): value is SxProps {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pushString(out: string[], value: string): void {
  for (const token of value.split(/\s+/)) {
    if (token !== '') out.push(token);
  }
}

function takeTransform(value: unknown): {
  readonly cls: string | undefined;
  readonly raw: SxProps['transform'];
  readonly ok: boolean;
} {
  if (!Array.isArray(value))
    return { cls: undefined, raw: undefined, ok: true };
  const pieces: { key: string; value: string | number }[] = [];
  for (const item of value as readonly unknown[]) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { cls: undefined, raw: value as SxProps['transform'], ok: false };
    }
    const keys = Object.keys(item);
    if (keys.length !== 1) {
      return { cls: undefined, raw: value as SxProps['transform'], ok: false };
    }
    const key = keys[0] ?? '';
    const entry = (item as Record<string, unknown>)[key];
    if (typeof entry !== 'string' && typeof entry !== 'number') {
      return { cls: undefined, raw: value as SxProps['transform'], ok: false };
    }
    pieces.push({ key, value: entry });
  }
  const cls = compileStaticTransform(pieces);
  if (cls === undefined) return { cls: undefined, raw: undefined, ok: true };
  return { cls, raw: undefined, ok: true };
}

function collectSx(target: CollectedMutable, props: SxProps): void {
  Object.assign(target.raw, props);
  for (const key of Object.keys(props)) {
    const value = (props as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (key === 'transform') {
      const taken = takeTransform(value);
      if (taken.ok) {
        if (taken.cls !== undefined) target.transformClass = taken.cls;
        continue;
      }
      target.transformRaw = taken.raw;
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      target.record[key] = value;
    }
  }
}

type CollectedMutable = {
  strings: string[];
  record: StaticRecord;
  raw: Record<string, unknown>;
  transformClass: string | undefined;
  transformRaw: SxProps['transform'];
};

function collectInputs(inputs: readonly CnInput[]): Collected {
  const mutable: CollectedMutable = {
    strings: [],
    record: {},
    raw: {},
    transformClass: undefined,
    transformRaw: undefined,
  };
  const walk = (input: CnInput): void => {
    if (input === false || input === null || input === undefined) return;
    if (typeof input === 'string') {
      pushString(mutable.strings, input);
      return;
    }
    if (Array.isArray(input)) {
      for (const entry of input as readonly CnInput[]) walk(entry);
      return;
    }
    if (isSxObject(input)) collectSx(mutable, input);
  };
  for (const input of inputs) walk(input);
  return {
    strings: mutable.strings,
    record: mutable.record,
    raw: mutable.raw,
    transformClass: mutable.transformClass,
    transformRaw: mutable.transformRaw,
  };
}

function dedupe(classes: readonly string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cls of classes) {
    if (cls === '' || seen.has(cls)) continue;
    seen.add(cls);
    out.push(cls);
  }
  return out.join(' ');
}

/**
 * Merge classes, sx objects, arrays, and falsy conditionals into one
 * deduped class string. Later sx entries win (flattenSx order); exact
 * duplicate classes collapse.
 */
export function cn(...inputs: readonly CnInput[]): string {
  const collected = collectInputs(inputs);
  const mapped = mapSxRecord(collected.record, collected.transformClass);
  return dedupe([...collected.strings, ...mapped.classes]);
}

function parseStyle(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const key = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    if (key !== '' && value !== '') out[key] = value;
  }
  return out;
}

type Partitioned = {
  readonly record: StaticRecord;
  readonly transformClass: string | undefined;
  readonly transformRaw: SxProps['transform'];
};

function partitionFlat(flat: SxProps): Partitioned {
  const record: StaticRecord = {};
  let transformClass: string | undefined;
  let transformRaw: SxProps['transform'];
  for (const key of Object.keys(flat)) {
    const value = (flat as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (key === 'transform') {
      const taken = takeTransform(value);
      if (taken.ok) {
        if (taken.cls !== undefined) transformClass = taken.cls;
        continue;
      }
      transformRaw = taken.raw;
      continue;
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      record[key] = value;
    }
  }
  return { record, transformClass, transformRaw };
}

/**
 * Inline-style record for the props `cn` cannot express as classes
 * (bailed props plus uncompilable transforms). Returns `undefined` when
 * every prop mapped to classes or was omitted like the runtime.
 */
export function cnStyle(
  ...inputs: readonly SxInput[]
): Record<string, string | number> | undefined {
  const flat = flattenSx(inputs.length === 1 ? inputs[0] : [...inputs]);
  if (flat === undefined) return undefined;
  const part = partitionFlat(flat);
  const mapped = mapSxRecord(part.record, part.transformClass);
  if (mapped.bailed.length === 0 && part.transformRaw === undefined) {
    return undefined;
  }
  const subset: Record<string, unknown> = {};
  for (const prop of mapped.bailed) {
    subset[prop] = (flat as Record<string, unknown>)[prop];
  }
  if (part.transformRaw !== undefined) subset['transform'] = part.transformRaw;
  const css = sxToCss(subset, {
    colors: CSS_VAR_COLORS,
    elevation: cssVarElevation,
  });
  if (css === '') return undefined;
  return parseStyle(css);
}
