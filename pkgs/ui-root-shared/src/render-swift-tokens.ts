/**
 * Swift projection of the design-token document. Pure: the generator writes
 * `design-system/swift/design-tokens.swift` and `tokens:verify` fails when
 * that file is stale. Values are resolved, so Swift does not follow aliases.
 */

import {
  isTokenTree,
  resolveTokenValue,
  type TokenTree,
} from './design-tokens';

const INDENT = '    ';

const SWIFT_KEYWORDS = new Set([
  'Any',
  'Self',
  'as',
  'associatedtype',
  'break',
  'case',
  'catch',
  'class',
  'continue',
  'default',
  'defer',
  'deinit',
  'do',
  'else',
  'enum',
  'extension',
  'fallthrough',
  'false',
  'fileprivate',
  'for',
  'func',
  'guard',
  'if',
  'import',
  'in',
  'init',
  'inout',
  'internal',
  'is',
  'let',
  'nil',
  'open',
  'operator',
  'precedencegroup',
  'private',
  'protocol',
  'public',
  'repeat',
  'rethrows',
  'return',
  'self',
  'static',
  'struct',
  'subscript',
  'super',
  'switch',
  'throw',
  'true',
  'try',
  'typealias',
  'var',
  'where',
  'while',
]);

const HEADER = `// Generated from design-system/design-tokens.json — do not edit.
// Paint with Color(.sRGB, red: green: blue: opacity:). Hue is degrees;
// saturation and lightness are percentages. A "px" quantity is one point.`;

const TYPES = `    public struct ColorValue: Equatable, Sendable {
        public let hue: Double
        public let saturation: Double
        public let lightness: Double
        public let alpha: Double
        public let red: Double
        public let green: Double
        public let blue: Double
    }

    public struct Quantity: Equatable, Sendable {
        public let value: Double
        public let unit: String
    }

    public struct Bezier: Equatable, Sendable {
        public let x1: Double
        public let y1: Double
        public let x2: Double
        public let y2: Double
    }`;

/** A token or group name Swift can use as an identifier. */
export function swiftIdentifier(name: string): string {
  const camel = name.replace(/-([a-zA-Z])/g, (_, letter: string) =>
    letter.toUpperCase()
  );
  const lead = /^[0-9]/.test(camel) ? `n${camel}` : camel;
  const ident = lead.replace(/-/g, '_');
  return SWIFT_KEYWORDS.has(ident) ? `\`${ident}\`` : ident;
}

/** HSL (hue degrees, saturation and lightness 0–100) to sRGB channels 0–1. */
export function hslToSrgb(
  hue: number,
  saturation: number,
  lightness: number
): readonly [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return roundUnit(l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

function roundUnit(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function num(value: number): string {
  return String(roundUnit(value));
}

function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function typeName(name: string): string {
  const ident = swiftIdentifier(name).replace(/`/g, '');
  return ident.charAt(0).toUpperCase() + ident.slice(1);
}

function components(value: unknown): readonly number[] {
  if (!isTokenTree(value) || !Array.isArray(value['components'])) {
    throw new Error(`expected a color, got ${JSON.stringify(value)}`);
  }
  const channels = value['components'];
  if (
    channels.length !== 3 ||
    !channels.every((item) => typeof item === 'number')
  ) {
    throw new Error(
      `expected three color channels, got ${JSON.stringify(value)}`
    );
  }
  return channels;
}

function renderColor(value: unknown): string {
  if (!isTokenTree(value) || value['colorSpace'] !== 'hsl') {
    throw new Error(`expected an hsl color, got ${JSON.stringify(value)}`);
  }
  const [hue, saturation, lightness] = components(value);
  const alpha = value['alpha'] === undefined ? 1 : value['alpha'];
  if (
    typeof alpha !== 'number' ||
    hue === undefined ||
    saturation === undefined ||
    lightness === undefined
  ) {
    throw new Error(`expected an hsl color, got ${JSON.stringify(value)}`);
  }
  const [red, green, blue] = hslToSrgb(hue, saturation, lightness);
  return `ColorValue(hue: ${num(hue)}, saturation: ${num(saturation)}, lightness: ${num(lightness)}, alpha: ${num(alpha)}, red: ${num(red)}, green: ${num(green)}, blue: ${num(blue)})`;
}

function renderQuantity(value: unknown): string {
  if (
    !isTokenTree(value) ||
    typeof value['value'] !== 'number' ||
    typeof value['unit'] !== 'string'
  ) {
    throw new Error(`expected a quantity, got ${JSON.stringify(value)}`);
  }
  return `Quantity(value: ${num(value['value'])}, unit: ${quote(value['unit'])})`;
}

function renderBezier(value: unknown): string {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every((item) => typeof item === 'number')
  ) {
    throw new Error(`expected a cubic bezier, got ${JSON.stringify(value)}`);
  }
  const [x1, y1, x2, y2] = value;
  return `Bezier(x1: ${num(x1 ?? 0)}, y1: ${num(y1 ?? 0)}, x2: ${num(x2 ?? 0)}, y2: ${num(y2 ?? 0)})`;
}

function renderFontFamily(value: unknown): string {
  const families = typeof value === 'string' ? [value] : value;
  if (
    !Array.isArray(families) ||
    !families.every((item) => typeof item === 'string')
  ) {
    throw new Error(`expected font families, got ${JSON.stringify(value)}`);
  }
  return `[${families.map((family) => quote(family)).join(', ')}]`;
}

function renderNumber(value: unknown): string {
  if (typeof value !== 'number') {
    throw new Error(`expected a number, got ${JSON.stringify(value)}`);
  }
  return num(value);
}

function renderValue(type: string, value: unknown): string {
  if (type === 'color') return renderColor(value);
  if (type === 'dimension' || type === 'duration') return renderQuantity(value);
  if (type === 'cubicBezier') return renderBezier(value);
  if (type === 'fontFamily') return renderFontFamily(value);
  if (type === 'fontWeight' || type === 'number') return renderNumber(value);
  throw new Error(`no Swift rendering for ${type}`);
}

function renderToken(
  root: TokenTree,
  token: TokenTree,
  type: string | undefined
): string {
  if (type === undefined) throw new Error('a token has no $type');
  return renderValue(type, resolveTokenValue(root, token['$value']));
}

function renderMembers(
  node: TokenTree,
  root: TokenTree,
  inherited: string | undefined,
  depth: number
): string {
  const type = typeof node['$type'] === 'string' ? node['$type'] : inherited;
  const pad = INDENT.repeat(depth);
  const lines: string[] = [];
  for (const name of Object.keys(node)) {
    if (name.startsWith('$')) continue;
    const child = node[name];
    if (!isTokenTree(child)) continue;
    if ('$value' in child) {
      lines.push(
        `${pad}public static let ${swiftIdentifier(name)} = ${renderToken(root, child, type)}`
      );
      continue;
    }
    lines.push(
      `${pad}public enum ${typeName(name)} {`,
      renderMembers(child, root, type, depth + 1),
      `${pad}}`
    );
  }
  return lines.join('\n');
}

/** Full contents of `design-tokens.swift`. */
export function renderSwiftTokens(tree: TokenTree): string {
  const members = renderMembers(tree, tree, undefined, 1);
  return `${HEADER}\npublic enum DesignTokens {\n${TYPES}\n\n${members}\n}\n`;
}
