/**
 * Finds visual values written in source instead of read from a token:
 * colors, lengths, durations, z-indexes, font settings, easings, opacities,
 * Tailwind steps off the token utilities (`w-12`, `h-7`) and numeric
 * constants. Comments are blanked first, so prose such as "48x28" in a doc
 * comment is not a literal.
 */
import type { LiteralFact, LiteralKind } from './inventory-types';

export type SourceLanguage = 'css' | 'ts';

type Pattern = {
  readonly kind: LiteralKind;
  readonly regex: RegExp;
  readonly languages: readonly SourceLanguage[];
};

const BOTH: readonly SourceLanguage[] = ['css', 'ts'];
const CSS: readonly SourceLanguage[] = ['css'];
const TS: readonly SourceLanguage[] = ['ts'];

const GRID_UTILITY = new RegExp(
  String.raw`(?<![\w-])-?(?:w|h|size|min-w|min-h|max-w|max-h|p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|inset|inset-x|inset-y|top|left|right|bottom|start|end|translate-x|translate-y|space-x|space-y|basis|z|opacity|duration|delay|scale|rotate|border|border-[trblxy]|ring|outline|outline-offset|ring-offset|stroke|leading|tracking|line-clamp|columns|grid-cols|grid-rows|col-span|row-span|order)-(?:\d+(?:\.\d+)?|px|\[[^\]\s'"\x60]+\])(?![\w-])`,
  'g'
);

/** In priority order: an earlier pattern's match masks later ones. */
const PATTERNS: readonly Pattern[] = [
  {
    kind: 'font',
    regex:
      /(?<![\w-])(?:font-family|font-weight|font-size|line-height|letter-spacing)\s*:\s*[^;{}]+/g,
    languages: CSS,
  },
  { kind: 'z-index', regex: /\bz-index\s*:\s*-?\d+/g, languages: CSS },
  { kind: 'z-index', regex: /\bzIndex['"]?\s*:\s*['"]?-?\d+/g, languages: TS },
  {
    kind: 'opacity',
    regex: /\bopacity['"]?\s*:\s*['"]?[\d.]+/g,
    languages: BOTH,
  },
  {
    kind: 'easing',
    regex:
      /(?<![\w-])(?:cubic-bezier|steps)\([^)]*\)|(?<![\w-])(?:ease-in-out|ease-in|ease-out|ease|linear)(?![\w-])/g,
    languages: CSS,
  },
  {
    kind: 'color',
    regex:
      /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\([^)]*\)?/g,
    languages: BOTH,
  },
  { kind: 'color', regex: /:\s*(?:white|black)\b/g, languages: CSS },
  { kind: 'duration', regex: /(?<![\w.#-])\d*\.?\d+m?s\b/g, languages: CSS },
  { kind: 'duration', regex: /(?<![\w.#-])\d+ms\b/g, languages: TS },
  {
    kind: 'length',
    regex:
      /(?<![\w.#-])-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|vh|vw|dvh|svh|lvh|vmin|vmax|ch|deg|%)(?![\w-])/g,
    languages: BOTH,
  },
  { kind: 'grid-utility', regex: GRID_UTILITY, languages: TS },
];

const NUMERIC_CONSTANT =
  /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*[\w.]+\s*)?=\s*(-?\d[\d_.]*)\s*(?:as const\s*)?;/;

/** Blanks comments, keeping every newline so line numbers stay true. */
export function blankComments(text: string, language: SourceLanguage): string {
  const blank = (match: string): string => match.replace(/[^\n]/g, ' ');
  const block = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (language === 'css') return block;
  return block.replace(/(?<![:'"\\\w])\/\/[^\n]*/g, blank);
}

/** `line-height: var(--ui-leading-sm)` reads a token; it is no literal. */
function onlyTokenReads(match: string): boolean {
  const value = match.includes(':') ? match.slice(match.indexOf(':') + 1) : '';
  return (
    value.includes('var(') && value.replace(/var\([^()]*\)/g, '').trim() === ''
  );
}

function contextOf(line: string): string {
  const trimmed = line.trim().replace(/\s+/g, ' ');
  return trimmed.length > 110 ? `${trimmed.slice(0, 107)}...` : trimmed;
}

function lineLiterals(
  line: string,
  language: SourceLanguage
): { kind: LiteralKind; literal: string }[] {
  const taken: [number, number][] = [];
  const out: { kind: LiteralKind; literal: string; at: number }[] = [];
  for (const pattern of PATTERNS) {
    if (!pattern.languages.includes(language)) continue;
    for (const match of line.matchAll(pattern.regex)) {
      const start = match.index;
      const end = start + match[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      if (onlyTokenReads(match[0])) continue;
      taken.push([start, end]);
      out.push({ kind: pattern.kind, literal: match[0].trim(), at: start });
    }
  }
  const constant = language === 'ts' ? line.match(NUMERIC_CONSTANT) : null;
  if (constant !== null && out.length === 0) {
    out.push({
      kind: 'numeric-constant',
      literal: `${constant[1]} = ${constant[2]}`,
      at: 0,
    });
  }
  return out
    .sort((a, b) => a.at - b.at)
    .map(({ kind, literal }) => ({ kind, literal }));
}

/** Every literal in one file. */
export function scanLiterals(
  file: string,
  text: string,
  language: SourceLanguage
): LiteralFact[] {
  const lines = blankComments(text, language).split('\n');
  return lines.flatMap((line, index) =>
    lineLiterals(line, language).map(({ kind, literal }) => ({
      file,
      line: index + 1,
      kind,
      literal,
      context: contextOf(line),
    }))
  );
}
