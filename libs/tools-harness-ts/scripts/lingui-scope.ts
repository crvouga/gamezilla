/**
 * Which source trees the one Lingui catalog is extracted from.
 *
 * Only packages that use a Lingui macro are listed, so the root `@libs/tools-harness-ts#ci:i18n`
 * task hashes those trees and nothing else — a change to a package with no
 * translatable text never reruns it. A package that starts using a macro
 * without being listed would ship hashed ids in production; every package's
 * `lint` verifies its own files against this list (`lint-package.ts`), and
 * `turbo.json`'s `@libs/tools-harness-ts#ci:i18n` inputs are kept equal to it by a test.
 */
export const LINGUI_CATALOG_SOURCES = [
  'libs/account-privacy-client-ts/src',
  'libs/app-root-client-ts/src',
  'libs/app-config-client-ts/src',
  'libs/auth-client-ts/src',
  'libs/billing-client-ts/src',
  'libs/chess-root-client-ts/src',
  'libs/connect-four-client-ts/src',
  'libs/quoridor-client-ts/src',
  'libs/word-tiles-client-ts/src',
  'libs/battleship-client-ts/src',
  'libs/hearts-client-ts/src',
  'libs/numberlink-client-ts/src',
  'libs/sokoban-client-ts/src',
  'libs/pong-client-ts/src',
  'libs/light-cycles-client-ts/src',
  'libs/game-menu-client-ts/src',
  'libs/game-session-client-ts/src',
  'libs/game-matchmaking-client-ts/src',
  'libs/chess-puzzle-client-ts/src',
  'libs/game-puzzle-client-ts/src',
  'libs/chess-shared-client-ts/src',
  'libs/friends-client-ts/src',
  'libs/notifications-client-ts/src',
  'libs/permissions-client-ts/src',
  'libs/synthetic-population-client-ts/src',
  'libs/profile-client-ts/src',
  'libs/search-client-ts/src',
  'libs/spaces-client-ts/src',
  'pkgs/chess-board-root-client-ts/src',
  'pkgs/ui-root-client-ts/src',
  'pkgs/ui-devtools-client-ts/src',
] as const;

/** A Lingui macro import: the only thing the extractor reads. */
export const LINGUI_MACRO_IMPORT =
  /from\s+['"]@lingui\/(?:core|solid)\/macro['"]/;

/** Test files never reach the catalog (`lingui.config.ts` excludes them). */
const TEST_FILE = /(^|\/)(?:tests|stories)\/|\.test\.tsx?$/;

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
