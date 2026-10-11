/**
 * Which source trees the one Lingui catalog is extracted from.
 *
 * Only packages that use a Lingui macro are listed, so the root `@libs/tools#ci:i18n`
 * task hashes those trees and nothing else — a change to a package with no
 * translatable text never reruns it. A package that starts using a macro
 * without being listed would ship hashed ids in production; every package's
 * `lint` checks its own files against this list (`lint-package.ts`), and
 * `turbo.json`'s `@libs/tools#ci:i18n` inputs are kept equal to it by a test.
 */
export const LINGUI_CATALOG_SOURCES = [
  'libs/account-privacy-client/src',
  'libs/app-root-client/src',
  'libs/app-config-client/src',
  'libs/auth-client/src',
  'libs/billing-client/src',
  'libs/chess-root-client/src',
  'libs/chess-custom-game-client/src',
  'libs/chess-matchmaking-client/src',
  'libs/chess-puzzle-client/src',
  'libs/chess-shared-client/src',
  'libs/friends-client/src',
  'libs/notifications-client/src',
  'libs/permissions-client/src',
  'libs/synthetic-population-client/src',
  'libs/profile-client/src',
  'libs/search-client/src',
  'libs/spaces-client/src',
  'pkgs/chess-board-root-client/src',
  'pkgs/harness-report-client/src',
  'pkgs/ui-root-client/src',
  'pkgs/ui-devtools-client/src',
] as const;

/** A Lingui macro import: the only thing the extractor reads. */
export const LINGUI_MACRO_IMPORT =
  /from\s+['"]@lingui\/(?:core|solid)\/macro['"]/;

/** Test files never reach the catalog (`lingui.config.ts` excludes them). */
const TEST_FILE = /(^|\/)tests\/|\.test\.tsx?$/;

export function underCatalogSource(
  relFile: string,
  sources: readonly string[] = LINGUI_CATALOG_SOURCES
): boolean {
  return sources.some((dir) => relFile.startsWith(`${dir}/`));
}

/**
 * Repo-relative files (with their text) that import a Lingui macro from
 * outside every catalog source — the files the extractor would skip.
 */
export function macrosOutsideCatalog(
  files: readonly { readonly path: string; readonly text: string }[],
  sources: readonly string[] = LINGUI_CATALOG_SOURCES
): readonly string[] {
  return files
    .filter(
      (file) =>
        /\.tsx?$/.test(file.path) &&
        !TEST_FILE.test(file.path) &&
        LINGUI_MACRO_IMPORT.test(file.text) &&
        !underCatalogSource(file.path, sources)
    )
    .map((file) => file.path);
}
