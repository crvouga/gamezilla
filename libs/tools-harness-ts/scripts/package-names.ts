/**
 * The package name convention, over every workspace manifest at once. Pure,
 * no I/O; `verify-package-names.ts` is the CI gate (`@libs/tools-harness-ts#ci:package-names`).
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
 *   `language` (`languages.ts`); a `neutral` package ends in none. There is
 *   no exemption: an absent suffix never means TypeScript.
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

function languageViolation(name: string, language: unknown): string | null {
  if (!isDeclaredLanguage(language)) return null; // package-boundaries reports it
  const spelled = languageOfName(name);
  if (language === NEUTRAL)
    return spelled === undefined
      ? null
      : `${name} is language-neutral, so its name ends in no language suffix (not ${suffixOf(spelled)})`;
  if (spelled === language) return null;
  if (spelled !== undefined)
    return `${name} is ${language} but its name spells ${spelled} (${suffixOf(spelled)})`;
  return `${name} is ${language}, so its name ends in ${suffixOf(language)}`;
}

function packageViolations(pkg: NamedPackage): readonly string[] {
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
    categoryOfName(name) !== category
  )
    out.push(
      `${name} is ${category}, so its name ends in ${runtimeSuffix(category)} before any language suffix`
    );
  const language = languageViolation(name, pkg.language);
  if (language !== null) out.push(language);
  return out;
}

/** Every package name convention the workspace breaks, as printable lines. */
export function packageNameViolations(
  packages: readonly NamedPackage[]
): readonly string[] {
  const byName = new Map<string, NamedPackage>();
  const out: string[] = [];
  for (const pkg of packages) {
    out.push(...packageViolations(pkg));
    if (typeof pkg.name !== 'string') continue;
    const twin = byName.get(pkg.name);
    if (twin !== undefined)
      out.push(`${pkg.name} is the name of both ${twin.dir} and ${pkg.dir}`);
    byName.set(pkg.name, pkg);
  }
  return out;
}
