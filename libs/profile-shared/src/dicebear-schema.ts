import { schema as coreSchema } from '@dicebear/core';
import { getStyleOrDefault } from './dicebear-styles';
import type { StyleKey } from './dicebear-styles';

/** Subset of JSON Schema props DiceBear uses for options. */
type JsonSchemaProp = {
  type?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  items?: JsonSchemaProp | JsonSchemaProp[];
  enum?: unknown[];
  pattern?: string;
};

export type SchemaField =
  | {
      kind: 'enum';
      key: string;
      values: string[];
      default: string[];
    }
  | {
      kind: 'color';
      key: string;
      default: string[];
    }
  | {
      kind: 'probability';
      key: string;
      min: number;
      max: number;
      default: number;
    }
  | {
      kind: 'integer';
      key: string;
      min: number;
      max: number;
      default: number;
    }
  | {
      kind: 'integerArray';
      key: string;
      itemMin: number;
      itemMax: number;
      default: number[];
    }
  | {
      kind: 'boolean';
      key: string;
      default: boolean;
    };

const CORE_BACKGROUND_KEYS = new Set([
  'backgroundType',
  'backgroundColor',
  'backgroundRotation',
]);

const CORE_TRANSFORM_KEYS = new Set([
  'flip',
  'rotate',
  'scale',
  'radius',
  'translateX',
  'translateY',
  'clip',
  'randomizeIds',
]);

const SKIP_KEYS = new Set(['seed', 'size']);

/** Merged JSON Schema properties: core options + style-specific options. */
export function getMergedSchemaProperties(
  styleKey: StyleKey
): Record<string, JsonSchemaProp> {
  const style = getStyleOrDefault(styleKey);
  const styleProps = (style.schema?.properties ?? {}) as Record<
    string,
    JsonSchemaProp
  >;
  const coreProps = (coreSchema.properties ?? {}) as Record<
    string,
    JsonSchemaProp
  >;
  return { ...coreProps, ...styleProps };
}

function parseBooleanField(
  key: string,
  def: JsonSchemaProp
): SchemaField | null {
  if (typeof def.default !== 'boolean') return null;
  return { kind: 'boolean', key, default: def.default };
}

function parseIntegerField(key: string, def: JsonSchemaProp): SchemaField {
  const min = typeof def.minimum === 'number' ? def.minimum : 0;
  const max = typeof def.maximum === 'number' ? def.maximum : 100;
  const defaultVal = typeof def.default === 'number' ? def.default : min;
  if (key.endsWith('Probability')) {
    return { kind: 'probability', key, min, max, default: defaultVal };
  }
  return { kind: 'integer', key, min, max, default: defaultVal };
}

function getItemSchema(def: JsonSchemaProp): JsonSchemaProp | null {
  const items = def.items;
  const itemSchema = Array.isArray(items) ? items[0] : items;
  if (
    itemSchema &&
    typeof itemSchema === 'object' &&
    !Array.isArray(itemSchema)
  ) {
    return itemSchema;
  }
  return null;
}

function parseIntegerArrayField(
  key: string,
  def: JsonSchemaProp,
  is: JsonSchemaProp
): SchemaField {
  const itemMin = typeof is.minimum === 'number' ? is.minimum : -360;
  const itemMax = typeof is.maximum === 'number' ? is.maximum : 360;
  const defaultVal = Array.isArray(def.default)
    ? (def.default as number[])
    : [itemMin, itemMax];
  return {
    kind: 'integerArray',
    key,
    itemMin,
    itemMax,
    default: defaultVal.length >= 2 ? defaultVal : [itemMin, itemMax],
  };
}

function isHexPattern(is: JsonSchemaProp): boolean {
  return is.pattern?.includes('a-fA-F0-9') ?? false;
}

function parseEnumOrColorField(
  key: string,
  def: JsonSchemaProp,
  is: JsonSchemaProp
): SchemaField | null {
  if (
    !Array.isArray(is.enum) ||
    !is.enum.every((x: unknown) => typeof x === 'string')
  ) {
    return null;
  }
  const values = is.enum as string[];
  const defaultVal = Array.isArray(def.default)
    ? (def.default as string[])
    : values;
  if (isHexPattern(is)) {
    return {
      kind: 'color',
      key,
      default: defaultVal.length > 0 ? defaultVal : ['000000'],
    };
  }
  return {
    kind: 'enum',
    key,
    values,
    default: defaultVal.length > 0 ? defaultVal : values,
  };
}

function parseColorStringArray(
  key: string,
  def: JsonSchemaProp,
  is: JsonSchemaProp
): SchemaField | null {
  if (is.type !== 'string' || !isHexPattern(is)) return null;
  const defaultVal = Array.isArray(def.default)
    ? (def.default as string[])
    : ['000000'];
  return { kind: 'color', key, default: defaultVal };
}

function parseArrayField(key: string, def: JsonSchemaProp): SchemaField | null {
  const is = getItemSchema(def);
  if (is === null) return null;
  if (is.type === 'integer') return parseIntegerArrayField(key, def, is);
  return (
    parseEnumOrColorField(key, def, is) ?? parseColorStringArray(key, def, is)
  );
}

const FIELD_PARSERS: Record<
  string,
  (key: string, def: JsonSchemaProp) => SchemaField | null
> = {
  boolean: parseBooleanField,
  integer: parseIntegerField,
  array: parseArrayField,
};

export function parseFieldFromDef(
  key: string,
  def: JsonSchemaProp
): SchemaField | null {
  if (SKIP_KEYS.has(key)) return null;
  const parser = def.type ? FIELD_PARSERS[def.type] : undefined;
  if (!parser) return null;
  return parser(key, def);
}

export function getFieldsForStyle(styleKey: StyleKey): SchemaField[] {
  const merged = getMergedSchemaProperties(styleKey);
  const fields: SchemaField[] = [];
  for (const [key, def] of Object.entries(merged)) {
    const f = parseFieldFromDef(key, def);
    if (f) fields.push(f);
  }
  fields.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return fields;
}

export type EditorTab =
  | 'features'
  | 'colors'
  | 'effects'
  | 'background'
  | 'transform';

export function fieldTab(field: SchemaField): EditorTab | null {
  const k = field.key;
  if (field.kind === 'probability') return 'effects';
  if (CORE_BACKGROUND_KEYS.has(k)) return 'background';
  if (field.kind === 'integerArray' && k === 'backgroundRotation') {
    return 'background';
  }
  if (CORE_TRANSFORM_KEYS.has(k)) return 'transform';
  if (field.kind === 'color') {
    if (k === 'backgroundColor') return 'background';
    return 'colors';
  }
  if (field.kind === 'enum') return 'features';
  return null;
}

export function getFieldsByTab(
  styleKey: StyleKey
): Record<EditorTab, SchemaField[]> {
  const fields = getFieldsForStyle(styleKey);
  const empty: Record<EditorTab, SchemaField[]> = {
    features: [],
    colors: [],
    effects: [],
    background: [],
    transform: [],
  };
  for (const f of fields) {
    const tab = fieldTab(f);
    if (tab) empty[tab].push(f);
  }
  return empty;
}

/** Defaults object from merged schema (for reset). */
export function getDefaultOptionsFromSchema(
  styleKey: StyleKey
): Record<string, unknown> {
  const merged = getMergedSchemaProperties(styleKey);
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(merged)) {
    if (SKIP_KEYS.has(key)) continue;
    if (
      def &&
      typeof def === 'object' &&
      'default' in def &&
      def.default !== undefined
    ) {
      out[key] = def.default as unknown;
    }
  }
  return out;
}
