/**
 * Product screens speak the design system's vocabulary, run by
 * lint-package.ts over every product client package (`libs/*-client`).
 *
 * `@pkgs/ui-root-client` owns how things look: type roles (`textTitle`,
 * `textCaption`, …), surfaces, radii and color tokens. A screen that reaches
 * past it for a font size, a weight, a shadow, an arbitrary value or a raw
 * color drifts from every other screen, so those are not words a product
 * package may write. Layout utilities (`flex-row`, `gap-3`, `p-4`) stay
 * free: arranging is the screen's job, painting is the design system's.
 *
 * Pure over the given texts, so it runs inside the cached `lint`.
 */

export type DesignSource = { readonly path: string; readonly text: string };

type Rule = {
  readonly name: string;
  readonly test: (token: string) => boolean;
  readonly instead: string;
};

const TYPE_UTILITY =
  /^(text-(xs|sm|base|lg|xl|[2-9]xl|2xs|micro|nano|caption|action)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|display|sans|mono)|leading-.+|tracking-.+|uppercase|lowercase|capitalize|italic)$/;

const RULES: readonly Rule[] = [
  {
    name: 'ad-hoc type',
    test: (token) => TYPE_UTILITY.test(token),
    instead:
      'a type role from hosts.css (`text textTitle | textHeading | textSubtitle | textBody | textBodyBold | textLabel | textCaption | textFootnote`, plus `textNumeral` for numbers)',
  },
  {
    name: 'shadow',
    test: (token) => /^(drop-)?shadow(-.+)?$/.test(token),
    instead:
      'a surface tier (`bg-surface`, `bg-surface-elevated`); the system paints no shadows',
  },
  {
    name: 'arbitrary value',
    test: (token) => /-\[[^\]]+\]$/.test(token),
    instead: 'a token step or a design-system component',
  },
  {
    name: 'raw color',
    test: (token) =>
      /^#[0-9a-fA-F]{3,8}$/.test(token) || /^(rgba?|hsla?)\(/.test(token),
    instead: 'a color token (`text-tint`, `var(--ui-color-*)`)',
  },
];

const STRING_LITERAL = /'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"|`([^`\\]|\\.)*`/g;

/** Comments name the words they ban; only code is read. */
function stripComments(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('*')) return '';
  return line;
}

/** Whitespace-separated words of every string literal on `line`. */
function literalTokens(line: string): readonly string[] {
  const out: string[] = [];
  for (const match of stripComments(line).matchAll(STRING_LITERAL)) {
    const body = match[0].slice(1, -1);
    for (const token of body.split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
  }
  return out;
}

/** Whether `path` is a product UI source this rule reads. */
export function isDesignSource(path: string): boolean {
  return /\.tsx$/.test(path) && !/(^|\/)tests\//.test(path);
}

/** Every off-vocabulary word in `files`, as messages. */
export function designVocabularyViolations(
  files: readonly DesignSource[]
): readonly string[] {
  const out: string[] = [];
  for (const file of files) {
    if (!isDesignSource(file.path)) continue;
    const lines = file.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const token of literalTokens(lines[i] ?? '')) {
        const rule = RULES.find((r) => r.test(token));
        if (rule === undefined) continue;
        out.push(
          `${file.path}:${i + 1}: ${rule.name} "${token}" — use ${rule.instead}`
        );
      }
    }
  }
  return out;
}
