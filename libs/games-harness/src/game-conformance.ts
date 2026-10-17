import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import type { GameCapability } from '@pkgs/turn-game-shared/game-rules';
import {
  GAME_CAPABILITIES,
  offeredCapabilities,
} from '@pkgs/turn-game-shared/game-rules';

/**
 * What the shared conformance suites are organised by: `rules`, which every
 * turn game is held to, and each capability, which binds only the games
 * offering it. A code suite's area is its directory
 * (`tests/conformance/<area>/`); a shared specification's areas are listed
 * in {@link SHARED_SPECIFICATIONS}.
 */
export const CONFORMANCE_AREAS = ['rules', ...GAME_CAPABILITIES] as const;
export type ConformanceArea = (typeof CONFORMANCE_AREAS)[number];

/**
 * The capabilities each specification of `specs/games/` shows, by file stem:
 * a feature, a Quint model, a decision table, a structure or an objective.
 * It runs once for every game offering all of them (a feature's scenarios
 * and a model's traces as one test per game; a decision table, structure or
 * objective checks every such game in its one run). Specifications sharing a
 * stem show the same capabilities. A specification missing here, or an
 * entry with none, fails the conformance matrix.
 */
export const SHARED_SPECIFICATIONS: Readonly<
  Record<string, readonly GameCapability[]>
> = {
  'game-choices': ['custom-games', 'matchmaking', 'history'],
  'custom-games': ['custom-games'],
  'custom-game-creation': ['custom-games'],
  'custom-game-invitations': ['custom-games'],
  'custom-game-open-places': ['custom-games'],
  'custom-game-readiness': ['custom-games'],
  'custom-game-sides': ['custom-games'],
  'custom-game-clock': ['custom-games'],
  'custom-game-away': ['custom-games'],
  'custom-game-completion': ['custom-games'],
  'custom-game-draw-offers': ['custom-games'],
  'game-turns': ['custom-games'],
  'finding-an-opponent': ['matchmaking'],
  'matched-game-abort': ['matchmaking'],
  'matched-game-draw-offers': ['matchmaking'],
  'matched-game-over': ['matchmaking'],
  'matched-game-rematch': ['matchmaking'],
  'matched-game-turns': ['matchmaking'],
  'game-history': ['custom-games', 'history'],
  'custom-game': ['custom-games'],
  'custom-game-play': ['custom-games'],
  'custom-game-control': ['custom-games'],
  'custom-game-local': ['custom-games'],
  'custom-game-access': ['custom-games'],
  'custom-game-delivery': ['custom-games'],
};

/** The file endings of the specifications a game is held to. */
export const SHARED_SPECIFICATION_KINDS = [
  '.feature',
  '.qnt',
  '.dmn',
  '.als',
  '.openslo.yaml',
] as const;

/** A specification's stem: its file name without the kind's ending. */
export function sharedSpecificationStem(specUri: string): string {
  const file = specUri.replace(/^.*\//, '');
  const kind = SHARED_SPECIFICATION_KINDS.find((ending) =>
    file.endsWith(ending)
  );
  if (kind === undefined)
    throw new Error(`${specUri}: not a specification a game is held to`);
  return file.slice(0, -kind.length);
}

/** The capabilities a shared specification shows, or a failure naming it. */
export function sharedSpecificationNeeds(
  specUri: string
): readonly GameCapability[] {
  const needs = SHARED_SPECIFICATIONS[sharedSpecificationStem(specUri)];
  if (needs === undefined)
    throw new Error(
      `${specUri}: list the capabilities it shows in SHARED_SPECIFICATIONS (@libs/games-harness/game-conformance)`
    );
  return needs;
}

/** Whether `game` is bound by a suite needing `needs` (`rules`: every game). */
export function offersAll(
  game: HarnessGame,
  needs: readonly (GameCapability | 'rules')[]
): boolean {
  const offered = offeredCapabilities(game.shared.turnGame);
  return needs.every((need) => need === 'rules' || offered.includes(need));
}

/** One shared suite: a code suite or a shared specification, and what it needs. */
export type ConformanceSuite = {
  /** `conformance/<area>/<file>` or `specs/games/<file>` (any kind). */
  readonly id: string;
  readonly area: ConformanceArea;
  readonly needs: readonly (GameCapability | 'rules')[];
};

/** A cell of the matrix: how one game stands against one area. */
export type ConformanceCell =
  /** The game does not offer the capability: nothing is owed. */
  | { readonly status: 'unsupported' }
  /** Offered, and these shared suites bind the game. */
  | { readonly status: 'bound'; readonly suites: readonly string[] }
  /** Offered, but no shared suite verifies it: a failure. */
  | { readonly status: 'missing' };

export type ConformanceRow = {
  readonly game: string;
  readonly cells: Readonly<Record<ConformanceArea, ConformanceCell>>;
};

/**
 * The game × capability matrix, derived only from what each game offers and
 * which shared suites exist: adding a game adds a row, adding a suite fills
 * cells, and an offered capability no suite verifies is `missing`.
 */
export function conformanceMatrix(
  games: readonly HarnessGame[],
  suites: readonly ConformanceSuite[]
): readonly ConformanceRow[] {
  return games.map((game) => {
    const offered = offeredCapabilities(game.shared.turnGame);
    const cell = (area: ConformanceArea): ConformanceCell => {
      if (area !== 'rules' && !offered.includes(area))
        return { status: 'unsupported' };
      const bound = suites
        .filter((suite) => suite.area === area && offersAll(game, suite.needs))
        .map((suite) => suite.id);
      return bound.length === 0
        ? { status: 'missing' }
        : { status: 'bound', suites: bound };
    };
    return {
      game: game.label,
      cells: Object.fromEntries(
        CONFORMANCE_AREAS.map((area) => [area, cell(area)])
      ) as Record<ConformanceArea, ConformanceCell>,
    };
  });
}

/** The matrix as a table: suites bound per cell, `—` unsupported, `MISSING`. */
export function formatConformanceMatrix(
  rows: readonly ConformanceRow[]
): string {
  const header = ['game', ...CONFORMANCE_AREAS];
  const lines = rows.map((row) => [
    row.game,
    ...CONFORMANCE_AREAS.map((area) => {
      const cell = row.cells[area];
      return cell.status === 'unsupported'
        ? '—'
        : cell.status === 'missing'
          ? 'MISSING'
          : `${String(cell.suites.length)} suite${cell.suites.length === 1 ? '' : 's'}`;
    }),
  ]);
  const widths = header.map((_, column) =>
    Math.max(...[header, ...lines].map((line) => line[column]!.length))
  );
  const render = (line: readonly string[]) =>
    `| ${line.map((text, column) => text.padEnd(widths[column]!)).join(' | ')} |`;
  return [
    render(header),
    render(widths.map((width) => '-'.repeat(width))),
    ...lines.map(render),
  ].join('\n');
}
