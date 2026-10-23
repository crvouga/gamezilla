/**
 * The one language registry. Every workspace manifest declares
 * `"language"`, one of these ids, and `package-boundaries.ts` holds its name
 * and dependencies to it. Pure, no I/O.
 *
 * A package's name is `<domain>-<feature>-<runtime>-<language suffix>`
 * (`@pkgs/clock-shared-swift`). A language-neutral package (schemas,
 * contracts, portable data) declares `"language": "neutral"` and ends in no
 * language suffix. The manifest field is authoritative; the suffix is the
 * convention the lint checks against it.
 *
 * A language is `supported` once its toolchain is pinned (`mise.toml`), its
 * thin task wrappers exist and CI runs it. Until then its suffix is reserved:
 * no package may claim it, so no name has to change when the language lands.
 * Adding one: [`docs/POLYGLOT.md`](../../../docs/POLYGLOT.md#adding-a-language).
 */

export type LanguageSpec = {
  /** The name suffix, without the dash: `@pkgs/clock-shared-swift`. */
  readonly suffix: string;
  /** Extensions of the language's own source files. */
  readonly sources: readonly string[];
  /** Whether packages may be written in it yet. */
  readonly supported: boolean;
  /** Packages must declare the `platforms` they build for. */
  readonly declaresPlatforms: boolean;
};

export const LANGUAGES = {
  typescript: {
    suffix: 'ts',
    sources: ['.ts', '.tsx', '.mts', '.cts'],
    supported: true,
    declaresPlatforms: false,
  },
  swift: {
    suffix: 'swift',
    sources: ['.swift'],
    supported: true,
    declaresPlatforms: true,
  },
  rust: {
    suffix: 'rust',
    sources: ['.rs'],
    supported: false,
    declaresPlatforms: true,
  },
  kotlin: {
    suffix: 'kotlin',
    sources: ['.kt', '.kts'],
    supported: false,
    declaresPlatforms: true,
  },
  go: {
    suffix: 'go',
    sources: ['.go'],
    supported: false,
    declaresPlatforms: true,
  },
} as const satisfies Readonly<Record<string, LanguageSpec>>;

export type Language = keyof typeof LANGUAGES;

/** Specifications, schemas and data any implementation reads. */
export const NEUTRAL = 'neutral';

export type DeclaredLanguage = Language | typeof NEUTRAL;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(LANGUAGES, value);
}

export function isDeclaredLanguage(value: unknown): value is DeclaredLanguage {
  return value === NEUTRAL || isLanguage(value);
}

/** The language a package name's suffix spells, or undefined. */
export function languageOfName(name: string): Language | undefined {
  const last = name.split('/').pop() ?? '';
  return (Object.keys(LANGUAGES) as Language[]).find((language) =>
    last.endsWith(`-${LANGUAGES[language].suffix}`)
  );
}

/** A package name without its language suffix: `clock-shared-swift` → `clock-shared`. */
export function withoutLanguageSuffix(name: string): string {
  const language = languageOfName(name);
  return language === undefined
    ? name
    : name.slice(0, -(LANGUAGES[language].suffix.length + 1));
}

/** Whether `path` is a source file of `language`. */
export function isSourceOf(language: Language, path: string): boolean {
  return LANGUAGES[language].sources.some((extension) =>
    path.endsWith(extension)
  );
}
