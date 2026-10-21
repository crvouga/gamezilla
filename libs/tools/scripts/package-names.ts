/**
 * The package name convention, over every workspace manifest at once. Pure,
 * no I/O; `verify-package-names.ts` is the CI gate (`@libs/tools#ci:package-names`).
 *
 * A package is `@<tier>/<domain>-<feature>-<runtime>-<language>`
 * (docs/POLYGLOT.md#names):
 *
 * - **Scope and directory.** `<tier>` is the directory it lives in
 *   (`apps/`, `libs/`, `pkgs/`) and the rest of the name is its directory's
 *   name, lower-kebab-case. Names are unique.
 * - **Runtime.** Outside `apps/`, the runtime suffix spells the declared
 *   `category` (`-client`, `-server`, `-shared` for isomorphic, `-harness`).
 *   A `neutral` package runs nowhere, so it has none (`@pkgs/sync-contracts`).
 * - **Language.** The language suffix comes last and spells the declared
 *   `language` (`languages.ts`); a `neutral` package ends in none. A
 *   TypeScript package may omit `-ts` only if it is in the frozen
 *   `legacy-package-names.json`, which only shrinks: at most
 *   `FROZEN_LEGACY_SIZE` entries, sorted, each a TypeScript package that still
 *   lacks the suffix.
 *
 * Reads only manifests, so the gate hashes nothing but `package.json` files
 * and these rules, and runs in milliseconds.
 */
import {
  isDeclaredLanguage,
  LANGUAGES,
  type Language,
  languageOfName,
  NEUTRAL,
  withoutLanguageSuffix,
} from './languages';

export const CATEGORIES = [
  'client',
  'server',
  'isomorphic',
  'harness',
] as const;
export type Category = (typeof CATEGORIES)[number];

const RUNTIME_SUFFIX: Readonly<Record<string, Category>> = {
  client: 'client',
  server: 'server',
  shared: 'isomorphic',
  harness: 'harness',
};

/**
 * The category a workspace package name spells, or undefined. The language
 * suffix comes after it: `@pkgs/clock-shared-swift` is isomorphic.
 */
export function categoryOfName(name: string): Category | undefined {
  const last = withoutLanguageSuffix(name).split('/').pop() ?? '';
  const suffix = last.match(/(?:^|-)(client|server|shared|harness)$/)?.[1];
  return suffix === undefined ? undefined : RUNTIME_SUFFIX[suffix];
}

function runtimeSuffix(category: Category): string {
  return `-${category === 'isomorphic' ? 'shared' : category}`;
}

/** Packages whose name spells no runtime, each for a reason. */
export const RUNTIME_NAME_EXEMPT: Readonly<Record<string, string>> = {
  '@libs/tools': 'the repository tooling, which ships no runtime code',
};

/**
 * The size of `legacy-package-names.json` when the language suffix rule
 * landed. Renaming a legacy package removes its entry; raising this number is
 * the only way to grow the list, and it is a reviewed change.
 */
export const FROZEN_LEGACY_SIZE = 332;

export type NamedPackage = {
  /** Repo-relative directory: `pkgs/clock-shared-swift`. */
  readonly dir: string;
  readonly name?: unknown;
  readonly category?: unknown;
  readonly language?: unknown;
};

const NAME = /^@(apps|libs|pkgs)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

function suffixOf(language: Language): string {
  return `-${LANGUAGES[language].suffix}`;
}

function languageViolation(
  name: string,
  language: unknown,
  legacy: ReadonlySet<string>
): string | null {
  if (!isDeclaredLanguage(language)) return null; // package-boundaries reports it
  const spelled = languageOfName(name);
  if (language === NEUTRAL)
    return spelled === undefined
      ? null
      : `${name} is language-neutral, so its name ends in no language suffix (not ${suffixOf(spelled)})`;
  if (spelled === language) return null;
  if (spelled !== undefined)
    return `${name} is ${language} but its name spells ${spelled} (${suffixOf(spelled)})`;
  if (language === 'typescript' && legacy.has(name)) return null;
  return `${name} is ${language}, so its name ends in ${suffixOf(language)} (only the frozen legacy-package-names.json may omit it)`;
}

function packageViolations(
  pkg: NamedPackage,
  legacy: ReadonlySet<string>
): readonly string[] {
  const [tier, dir] = pkg.dir.split('/');
  const name = typeof pkg.name === 'string' ? pkg.name : '';
  const match = NAME.exec(name);
  if (match === null)
    return [
      `${pkg.dir}: name ${JSON.stringify(pkg.name ?? null)} is not @${tier}/<lower-kebab-case>`,
    ];
  const out: string[] = [];
  if (match[1] !== tier || match[2] !== dir)
    out.push(
      `${pkg.dir}: ${name} lives in ${tier}/${dir}, so it is named @${tier}/${dir}`
    );
  const category = pkg.category as Category;
  if (
    tier !== 'apps' &&
    pkg.language !== NEUTRAL &&
    CATEGORIES.includes(category) &&
    !Object.hasOwn(RUNTIME_NAME_EXEMPT, name) &&
    categoryOfName(name) !== category
  )
    out.push(
      `${name} is ${category}, so its name ends in ${runtimeSuffix(category)} before any language suffix`
    );
  const language = languageViolation(name, pkg.language, legacy);
  if (language !== null) out.push(language);
  return out;
}

function legacyViolations(
  legacy: readonly string[],
  byName: ReadonlyMap<string, NamedPackage>
): readonly string[] {
  const out: string[] = [];
  if (legacy.length > FROZEN_LEGACY_SIZE)
    out.push(
      `legacy-package-names.json holds ${legacy.length} names but is frozen at ${FROZEN_LEGACY_SIZE}: a new package ends in its language suffix instead`
    );
  const sorted = [...new Set(legacy)].sort();
  if (legacy.join('\n') !== sorted.join('\n'))
    out.push('legacy-package-names.json is sorted and holds each name once');
  for (const name of legacy) {
    const pkg = byName.get(name);
    if (pkg === undefined)
      out.push(
        `legacy-package-names.json lists ${name}, which no longer exists: delete the line`
      );
    else if (
      pkg.language !== 'typescript' ||
      name.endsWith(suffixOf('typescript'))
    )
      out.push(
        `legacy-package-names.json lists ${name}, which needs no exemption: delete the line`
      );
  }
  return out;
}

/** Every package name convention the workspace breaks, as printable lines. */
export function packageNameViolations(
  packages: readonly NamedPackage[],
  legacy: readonly string[]
): readonly string[] {
  const legacySet = new Set(legacy);
  const byName = new Map<string, NamedPackage>();
  const out: string[] = [];
  for (const pkg of packages) {
    out.push(...packageViolations(pkg, legacySet));
    if (typeof pkg.name !== 'string') continue;
    const twin = byName.get(pkg.name);
    if (twin !== undefined)
      out.push(`${pkg.name} is the name of both ${twin.dir} and ${pkg.dir}`);
    byName.set(pkg.name, pkg);
  }
  return [...out, ...legacyViolations(legacy, byName)];
}
