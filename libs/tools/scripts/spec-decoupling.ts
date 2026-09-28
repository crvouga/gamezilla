/**
 * D1 (docs/SPEC_STANDARDS.md § D. Decoupling): nothing in `specs/` points at
 * the codebase. Code points at specs, never the other way round, so a feature,
 * a Quint model or a glossary names no file path, no workspace package, no
 * source file, and carries no tag outside the traceability allow-list — a tag
 * that says which host or runner can run a scenario is implementation, and
 * lives beside the bindings instead.
 *
 * Pure over the files' text, so `check-specs.ts` runs it in milliseconds.
 */

/** The only tags a feature may carry: product-level traceability. */
export const ALLOWED_TAG_PREFIXES: readonly string[] = [
  '@domain:',
  '@goal:',
  '@regression:',
];

export type SpecText = {
  /** Repo-relative path (`specs/friends/friend-remove.feature`). */
  readonly path: string;
  readonly text: string;
};

type Rule = { readonly what: string; readonly pattern: RegExp };

const SOURCE_EXTENSIONS =
  'tsx?|jsx?|mjs|cjs|json|md|sql|ya?ml|toml|sh|feature|qnt|html|css';

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
      if (ALLOWED_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))) {
        continue;
      }
      out.push(
        `${path}:${String(index + 1)}: D1 tag ${tag} is not traceability (${ALLOWED_TAG_PREFIXES.join(', ')}) — where a scenario can run belongs beside its bindings, not in the spec`
      );
    }
  }
  return out;
}

function textProblems(path: string, lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const [index, line] of lines.entries()) {
    const seen = new Set<string>();
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

/** Every D1 break in `files`; empty when specs/ points at nothing in code. */
export function decouplingProblems(
  files: readonly SpecText[]
): readonly string[] {
  return files.flatMap((file) => {
    const lines = file.text.split('\n');
    return [
      ...(file.path.endsWith('.feature') ? tagProblems(file.path, lines) : []),
      ...textProblems(file.path, lines),
    ];
  });
}
