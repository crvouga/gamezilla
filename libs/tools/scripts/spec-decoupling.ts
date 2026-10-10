/**
 * D1 (specs/README.md § D. Decoupling): nothing in `specs/` points at
 * the codebase. Code points at specs, never the other way round, so no file
 * under `specs/` — feature, Quint model, decision table, structure,
 * objective, glossary or the conformance manifest — names a file path, a
 * workspace package or a source file, and no feature carries a tag outside
 * the traceability allow-list — a tag that says which host or runner can run
 * a scenario is implementation, and lives beside the bindings instead. The
 * rulebook, `specs/README.md`, necessarily names the paths it lays out. The
 * product map's `source` and journey `gherkin` fields are also
 * traceability addresses rather than product prose; the statechart gate
 * validates those addresses separately.
 *
 * Pure over the files' text, so `check-specs.ts` runs it in milliseconds.
 */

/** The only tags a feature may carry: product-level traceability. */
export const ALLOWED_TAG_PREFIXES: readonly string[] = [
  '@domain:',
  '@regression:',
];

/** Tags that mean one thing and take no suffix. `@synthetic-production` is not one. */
export const ALLOWED_EXACT_TAGS: readonly string[] = ['@synthetic'];

function tagAllowed(tag: string): boolean {
  return (
    ALLOWED_EXACT_TAGS.includes(tag) ||
    ALLOWED_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))
  );
}

/** The rulebook: it states the layout, so it names paths. */
export const RULEBOOK = 'specs/README.md';

export type SpecText = {
  /** Repo-relative path (`specs/friends/friend-remove.feature`). */
  readonly path: string;
  readonly text: string;
};

type Rule = { readonly what: string; readonly pattern: RegExp };

const SOURCE_EXTENSIONS =
  'tsx?|jsx?|mjs|cjs|json|md|sql|ya?ml|toml|sh|feature|qnt|dmn|als|html|css';

const RULES: readonly Rule[] = [
  {
    what: 'a workspace package',
    pattern: /@(?:pkgs|libs|apps)\/[\w./-]*/g,
  },
  {
    what: 'a repo directory',
    pattern:
      /(?<![\w./@-])(?:apps|libs|pkgs|tools|docs|specs|src|tests|scripts|node_modules)\/[\w./<>-]*/g,
  },
  {
    what: 'a source file',
    pattern: new RegExp(
      `(?<![\\w.])[\\w./-]*[\\w-]\\.(?:${SOURCE_EXTENSIONS})(?![\\w.])`,
      'g'
    ),
  },
];

function tagProblems(path: string, lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('@')) continue;
    for (const tag of trimmed.split(/\s+/)) {
      if (tag.startsWith('#')) break;
      if (tagAllowed(tag)) continue;
      out.push(
        `${path}:${String(index + 1)}: D1 tag ${tag} is not traceability (${[...ALLOWED_TAG_PREFIXES, ...ALLOWED_EXACT_TAGS].join(', ')}) — where a scenario can run belongs beside its bindings, not in the spec`
      );
    }
  }
  return out;
}

function textProblems(path: string, lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const [index, line] of lines.entries()) {
    const seen = new Set<string>();
    // Composition provenance names specifications, never implementation files.
    if (
      path.endsWith('.qnt') &&
      /^\/\/ Sources: specs\/[a-z0-9-]+(?:, specs\/[a-z0-9-]+)*$/.test(line)
    )
      continue;
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.pattern)) {
        const found = match[0].replace(/\.+$/, '');
        if ([...seen].some((earlier) => earlier.includes(found))) continue;
        seen.add(found);
        out.push(
          `${path}:${String(index + 1)}: D1 names ${rule.what} "${found}" — specs never point at code; say it in product words`
        );
      }
    }
  }
  return out;
}

function withoutProductMapTraceability(
  path: string,
  lines: readonly string[]
): readonly string[] {
  if (path === 'specs/journeys.yaml') {
    return lines.map((line) =>
      /^\s*-\s+(?:specs|docs)\//.test(line) ? '' : line
    );
  }
  if (path !== 'specs/product.machine.json') return lines;
  let sourceIndent: number | undefined;
  return lines.map((line) => {
    if (sourceIndent !== undefined) {
      if (
        line.trim().startsWith(']') &&
        line.length - line.trimStart().length === sourceIndent
      )
        sourceIndent = undefined;
      return '';
    }
    if (/^\s*"source": \[/.test(line)) {
      if (!line.includes(']'))
        sourceIndent = line.length - line.trimStart().length;
      return '';
    }
    return line;
  });
}

/** Every D1 break in `files`; empty when specs/ points at nothing in code. */
export function decouplingProblems(
  files: readonly SpecText[]
): readonly string[] {
  return files.flatMap((file) => {
    if (file.path === RULEBOOK) return [];
    const lines = withoutProductMapTraceability(
      file.path,
      file.text.split('\n')
    );
    return [
      ...(file.path.endsWith('.feature') ? tagProblems(file.path, lines) : []),
      ...textProblems(file.path, lines),
    ];
  });
}
