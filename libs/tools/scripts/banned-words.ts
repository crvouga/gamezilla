/**
 * Words the repo no longer uses, run by lint-package.ts over a package's
 * paths and text (and by `//#lint:root` over the rest).
 *
 * A banned word is jargon that names a mechanism instead of the thing: a
 * behavior test is a *spec* (`specs/<domain>/`, run by `test:spec`), its
 * composition is the *harness* (`tests/harness/`), and build flags that keep
 * probes on are *test hooks* (`VITE_TEST_HOOKS`). Each entry says what to
 * write instead.
 *
 * Pure over the given paths and texts, so it runs inside the cached `lint`.
 */

type BannedWord = {
  readonly word: string;
  /** Matches the word as a path segment, prose word or identifier part. */
  readonly pattern: RegExp;
  readonly instead: string;
};

const BANNED: readonly BannedWord[] = [
  {
    word: 'e2e',
    // A word or kebab/snake segment (`e2e`, `test:e2e`, `VITE_E2E`), or the
    // tail of a camel identifier (`fooE2eBar`). Not a chess move (`e2e4`) or a
    // hex digest (`fe2edb…`).
    pattern:
      /(?<![0-9A-Za-z])[eE]2[eE](?![0-9a-f])|(?<=[a-z])E2[Ee](?![0-9a-z])/,
    instead:
      'spec (behavior tests, `test:spec`), harness (`tests/harness/`) or test hooks (`VITE_TEST_HOOKS`)',
  },
];

export type TextFile = { readonly path: string; readonly text: string };

/** Text worth reading for words; binaries and data dumps are skipped. */
const TEXT_FILE =
  /\.(ts|tsx|js|mjs|cjs|mts|cts|json|jsonc|md|yml|yaml|feature|qnt|html|css|sh|toml|grit)$/;
/** This rule's own source and test name the words they ban. */
const EXEMPT =
  /(^|\/)libs\/tools\/scripts\/banned-words(\.test)?\.ts$|^scripts\/banned-words(\.test)?\.ts$/;

/** Whether `path` is text this rule reads. */
export function isWordedFile(path: string): boolean {
  return TEXT_FILE.test(path) && !EXEMPT.test(path);
}

/** Every banned word in `paths` and in the lines of `files`, as messages. */
export function bannedWordViolations(input: {
  readonly paths: readonly string[];
  readonly files: readonly TextFile[];
}): readonly string[] {
  const out: string[] = [];
  for (const { word, pattern, instead } of BANNED) {
    for (const path of input.paths) {
      if (pattern.test(path)) out.push(`${path}: "${word}" — write ${instead}`);
    }
    for (const file of input.files) {
      const lines = file.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i] ?? '')) {
          out.push(`${file.path}:${i + 1}: "${word}" — write ${instead}`);
        }
      }
    }
  }
  return out;
}
