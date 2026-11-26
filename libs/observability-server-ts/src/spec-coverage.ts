/**
 * Which live checks stand behind each bounded context in `specs/`, so that
 * no alert can mean every context works in production. A context is watched
 * by every check named after it (`<context>.<feature>`, or the journey
 * `journeys.<context>-<…>`), so a game needs no entry here; any other
 * context with a `.feature` file is named here exactly once:
 *
 * - `watched`: the Health checks that exercise it in production. Each is
 *   counted by an objective's indicator, so its failure, or its silence
 *   (`evidence-freshness.ts`), alerts.
 * - `exempt`: nothing a person does reaches it in production, and why its
 *   failure still cannot go unnoticed.
 * - `unwatched`: a person depends on it in production but no live check
 *   exercises it yet. The list only shrinks (`tests/spec-coverage.test.ts`
 *   pins it): while it is not empty, no alert does not yet mean everything
 *   works, and `bun obs` / the README say which contexts are blind.
 */

import type { SyntheticCheck } from './synthetic-checks';
import { SYNTHETIC_CHECKS } from './synthetic-checks';

export type ContextCoverage =
  | { readonly kind: 'watched'; readonly checks: readonly SyntheticCheck[] }
  | { readonly kind: 'exempt'; readonly why: string }
  | { readonly kind: 'unwatched'; readonly why: string };

const watched = (...checks: SyntheticCheck[]): ContextCoverage => ({
  kind: 'watched',
  checks,
});

const GAME_JOURNEYS: readonly SyntheticCheck[] = [
  'journeys.back-from-quoridor',
  'journeys.battleship-game',
  'journeys.chess-puzzle-history',
  'journeys.connect-four-game',
  'journeys.critical-journeys',
  'journeys.custom-game',
  'journeys.hearts-first-trick',
  'journeys.hearts-start',
  'journeys.light-cycles-start',
  'journeys.multiplayer-game',
  'journeys.numberlink-packs',
  'journeys.pong-game',
  'journeys.quoridor-game',
  'journeys.recover-custom-game',
  'journeys.return-to-quoridor',
  'journeys.sokoban-packs',
  'journeys.word-tiles-start',
];

/** Every bounded context in `specs/` that has behavior (`.feature` files). */
export const SPEC_COVERAGE: Readonly<Record<string, ContextCoverage>> = {
  auth: watched('auth.sign-in', 'journeys.critical-journeys'),
  billing: watched('billing.payments', 'journeys.critical-journeys'),
  chess: watched(
    'journeys.chess-puzzle-history',
    'journeys.critical-journeys',
    'journeys.multiplayer-game',
    'journeys.custom-game'
  ),
  'chess-board': watched(
    'journeys.chess-puzzle-history',
    'journeys.critical-journeys',
    'journeys.multiplayer-game',
    'journeys.custom-game'
  ),
  'db-indexes': {
    kind: 'exempt',
    why: 'Index reconciliation runs inside Release, never on behalf of a person; a failed run fails Release, which alerts as an important CI workflow failing on main.',
  },
  'developer-tools': {
    kind: 'exempt',
    why: "The team's own test-world and release tools; they run in development and CI, never in production, and a failure fails the CI workflow that uses them.",
  },
  feedback: watched('feedback.receiving-bug-reports'),
  friends: {
    kind: 'unwatched',
    why: 'Only people search is checked live (critical journeys); sending, accepting and blocking friends are not.',
  },
  games: watched(...GAME_JOURNEYS),
  journeys: watched(...GAME_JOURNEYS, 'journeys.join-and-offline'),
  matchmaking: watched('journeys.multiplayer-game'),
  observatory: {
    kind: 'unwatched',
    why: 'No live check opens the User Observatory in production.',
  },
  profile: {
    kind: 'unwatched',
    why: 'Signing in, changing an avatar and finding a person are checked live; deleting an account and exporting personal data within their deadlines are not.',
  },
  puzzles: watched(
    'journeys.chess-puzzle-history',
    'journeys.critical-journeys',
    'journeys.numberlink-packs',
    'journeys.sokoban-packs'
  ),
  room: watched(
    'journeys.multiplayer-game',
    'journeys.battleship-game',
    'journeys.connect-four-game',
    'journeys.pong-game',
    'journeys.quoridor-game'
  ),
  runtime: watched(
    'runtime.reaching-the-app',
    'runtime.serving-people',
    'runtime.connected-services',
    'runtime.stored-files',
    'runtime.declared-environment',
    'runtime.request-records'
  ),
  spaces: watched(
    'spaces.spaces',
    'spaces.live-updates',
    'journeys.join-and-offline',
    'journeys.return-to-quoridor'
  ),
  'sync-engine': watched(
    'journeys.join-and-offline',
    'journeys.multiplayer-game'
  ),
  'synthetic-population': {
    kind: 'unwatched',
    why: 'No live check sees Synthetic Users online and looking for opponents in production.',
  },
};

/** The checks named after `context`: its own features and its journeys. */
export function derivedChecks(context: string): readonly SyntheticCheck[] {
  return SYNTHETIC_CHECKS.filter(
    (check) =>
      check.startsWith(`${context}.`) ||
      check.startsWith(`journeys.${context}-`)
  );
}

/** Contexts a person depends on that no live check exercises yet. */
export function unwatchedContexts(): readonly string[] {
  return Object.entries(SPEC_COVERAGE)
    .filter(([, coverage]) => coverage.kind === 'unwatched')
    .map(([context]) => context)
    .sort();
}

/**
 * Everything wrong between `contexts` (the folders of `specs/` that hold a
 * `.feature`) and the coverage map, given the checks the live objectives'
 * indicators count.
 */
export function specCoverageIssues(input: {
  readonly contexts: readonly string[];
  readonly countedChecks: ReadonlySet<string>;
}): readonly string[] {
  const issues: string[] = [];
  for (const context of input.contexts) {
    const derived = derivedChecks(context);
    if (SPEC_COVERAGE[context] === undefined && derived.length === 0)
      issues.push(
        `specs/${context} has behavior but no live check is named after it and it has no entry in SPEC_COVERAGE (libs/observability-server-ts/src/spec-coverage.ts): name the live checks that exercise it in production`
      );
    for (const check of derived.filter((c) => !input.countedChecks.has(c)))
      issues.push(
        `${context} is watched by ${check}, which no live objective's indicator counts`
      );
  }
  for (const [context, coverage] of Object.entries(SPEC_COVERAGE)) {
    if (!input.contexts.includes(context))
      issues.push(`SPEC_COVERAGE names ${context}, which specs/ does not have`);
    if (coverage.kind === 'watched') {
      if (coverage.checks.length === 0)
        issues.push(`${context} is watched by no check`);
      for (const check of coverage.checks.filter(
        (c) => !input.countedChecks.has(c)
      ))
        issues.push(
          `${context} is watched by ${check}, which no live objective's indicator counts`
        );
    } else if (coverage.why.trim() === '') {
      issues.push(`${context} is ${coverage.kind} without saying why`);
    }
  }
  return issues;
}
