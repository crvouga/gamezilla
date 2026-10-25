import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type { GameCapability } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  GAME_CAPABILITIES,
  gameSides,
  offeredCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  executionGameProblems,
  suiteCaseProblems,
} from './conformance-enrollment';
import { loadSpecificationNeeds } from './load-specification-needs';

/**
 * What the shared conformance suites are organised by: `rules`, which every
 * turn game is held to, and each capability, which binds only the games
 * offering it. A code suite's area is its directory
 * (`tests/conformance/<area>/`); a shared specification's areas are listed
 * in {@link SHARED_SPECIFICATIONS}.
 */
export const CONFORMANCE_AREAS = [
  'rules',
  'simulation',
  ...GAME_CAPABILITIES,
] as const;
export type ConformanceArea = (typeof CONFORMANCE_AREAS)[number];

/**
 * What some shared specifications need beyond a capability: a trait of the
 * game's rules that not every game has, shown by its fixtures. A game
 * without the fixture lacks the trait, which the rules laws verify (a side
 * that cannot win, a draw by its rules: bounded play never reaches one), so
 * a specification
 * needing it holds for exactly the games whose rules have it.
 */
export const GAME_TRAITS = {
  'two seats': (game: HarnessGame) =>
    gameSides(game.shared.registration.rules).length === 2,
  'more than two seats': (game: HarnessGame) =>
    gameSides(game.shared.registration.rules).length > 2,
  'clock choices': (game: HarnessGame) =>
    game.shared.capabilities.matchmaking?.clockChoices === true,
  'no clock choices': (game: HarnessGame) =>
    game.shared.capabilities.matchmaking !== undefined &&
    game.shared.capabilities.matchmaking.clockChoices === undefined,
  /** A genuine discrete-turn capability; simulations never invent one. */
  turns: (game: HarnessGame) => game.shared.turnGame !== undefined,
  'no turns': (game: HarnessGame) => game.shared.turnGame === undefined,
  /** Simulation and turns may both be present on one registration. */
  simulation: (game: HarnessGame) =>
    game.shared.registration.simulation !== undefined,
  /** A puzzle line whose opponent supplies setup and automatic replies. */
  'a puzzle opponent': (game: HarnessGame) => {
    const puzzles = game.shared.registration.capabilities.puzzles;
    return puzzles !== undefined && puzzleLineLayout(puzzles).solverStep === 2;
  },
  /** A position where the second side cannot win (`secondSideCannotWin`). */
  'a side that cannot win': (game: HarnessGame) =>
    isTurnHarnessGame(game) && game.fixtures.secondSideCannotWin !== undefined,
  /** A line the game's own rules draw (`drawByRules`). */
  "a draw by the game's own rules": (game: HarnessGame) =>
    isTurnHarnessGame(game) && game.fixtures.drawByRules !== undefined,
  /**
   * Private setups each side prepares before play (`rules.setup`), which
   * only the authority holds together; the rules laws hold such a game to
   * resolving every proposal and never showing a setup.
   */
  'a private setup': (game: HarnessGame) =>
    game.shared.registration.rules.setup !== undefined,
  /**
   * Every position public, so a custom game without another person may be
   * played on the host's device alone; a game with private setups is not.
   */
  'every position public': (game: HarnessGame) =>
    game.shared.registration.rules.setup === undefined,
  /**
   * A known first-side victory of exactly seven moves (`firstSideVictory`),
   * which the whole-game models follow (`tests/quint/model-game.ts`). A
   * game whose every victory is longer (Battleship needs 17 hits) is held to
   * the models that play only the start of its known victory.
   */
  'a seven-move victory': (game: HarnessGame) =>
    isTurnHarnessGame(game) && game.fixtures.firstSideVictory.length === 7,
  /** A known puzzle the game's rules let the solver win off its line (`wonAnotherWay`). */
  'a known puzzle won another way': (game: HarnessGame) =>
    isTurnHarnessGame(game) &&
    game.fixtures.puzzles?.some(
      (fixture) => fixture.wonAnotherWay !== undefined
    ) === true,
} as const satisfies Readonly<Record<string, (game: HarnessGame) => boolean>>;
export type GameTrait = keyof typeof GAME_TRAITS;

/** What a shared specification can need: a capability or a trait. */
export type ConformanceNeed = GameCapability | GameTrait;

function isTrait(need: string): need is GameTrait {
  return Object.hasOwn(GAME_TRAITS, need);
}

/** The capabilities among `needs`, which are the areas it is counted in. */
export function capabilitiesOf(
  needs: readonly ConformanceNeed[]
): readonly GameCapability[] {
  return needs.filter((need): need is GameCapability => !isTrait(need));
}

/**
 * The capabilities, and any trait, each specification of `specs/games/`
 * shows, by file stem: a feature, a Quint model, a decision table, a
 * structure or an objective.
 * It runs once for every game offering all of them (a feature's scenarios
 * and a model's traces as one test per game; a decision table, structure or
 * objective checks every such game in its one run). Specifications sharing a
 * stem show the same capabilities. A specification missing here, or an
 * entry with none, fails the conformance matrix.
 */
export const SHARED_SPECIFICATIONS: Readonly<
  Record<string, readonly ConformanceNeed[]>
> = await loadSpecificationNeeds();

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

/** What a shared specification shows, or a failure naming it. */
export function sharedSpecificationNeeds(
  specUri: string
): readonly ConformanceNeed[] {
  const needs = SHARED_SPECIFICATIONS[sharedSpecificationStem(specUri)];
  if (needs === undefined)
    throw new Error(
      `${specUri}: list the capabilities it shows in SHARED_SPECIFICATIONS (@libs/games-harness-ts/game-conformance)`
    );
  return needs;
}

/** Whether `game` is bound by a suite needing `needs` (`rules`: every game). */
export function offersAll(
  game: HarnessGame,
  needs: readonly (ConformanceNeed | 'rules')[]
): boolean {
  const offered = offeredCapabilities(game.shared.registration);
  return needs.every((need) =>
    need === 'rules'
      ? true
      : isTrait(need)
        ? GAME_TRAITS[need](game)
        : offered.includes(need)
  );
}

/**
 * The games a shared specification holds, among `games`: each offering
 * everything it shows. Its runs (one test and one evidence obligation per
 * game) and the report's per-game requirement both come from here, so a
 * game the specification needs without a verdict of its own reads as
 * missing, never satisfied by another game's.
 */
export function specificationGames<Game extends HarnessGame>(
  specUri: string,
  games: readonly Game[]
): readonly Game[] {
  const needs = sharedSpecificationNeeds(specUri);
  return games.filter((game) => offersAll(game, needs));
}

/**
 * For every shared specification, the ids of the games it must have a
 * verdict of its own for, and every game there is: what the conformance
 * report holds each game × specification cell to.
 */
export function requiredGames(
  specUris: readonly string[],
  games: readonly HarnessGame[]
): {
  readonly variants: readonly string[];
  readonly required: Readonly<Record<string, readonly string[]>>;
} {
  return {
    variants: games.map((game) => game.shared.id),
    required: Object.fromEntries(
      specUris.map((uri) => [
        uri,
        specificationGames(uri, games).map((game) => game.shared.id),
      ])
    ),
  };
}

/** One shared suite: a code suite or a shared specification, and whom it binds. */
export type ConformanceSuite = {
  /** `conformance/<area>/<file>` or `specs/games/<file>` (any kind). */
  readonly id: string;
  readonly area: ConformanceArea;
  /** Whether the suite requires a case of `game`. */
  readonly binds: (game: HarnessGame) => boolean;
};

/**
 * A code suite as planning read it: for each game its area binds (by id),
 * whether it registers a case of that game; `null` when the file never
 * calls `forEveryGame`, so it binds nothing.
 */
export type PlannedCodeSuite = {
  readonly id: string;
  readonly area: ConformanceArea;
  /** Additional capabilities or traits required beside the directory's area. */
  readonly needs?: readonly ConformanceNeed[];
  readonly registers: Readonly<Record<string, boolean>> | null;
};

/** The planned code suites as matrix suites: each binds the games it has a case of. */
export function codeConformanceSuites(
  planned: readonly PlannedCodeSuite[]
): readonly ConformanceSuite[] {
  return planned.map((suite) => ({
    id: suite.id,
    area: suite.area,
    binds: (game) => suite.registers?.[game.shared.id] === true,
  }));
}

/**
 * Each shared specification as a suite of every capability it shows,
 * binding the games offering all it needs. A specification the table does
 * not list correctly binds nothing ({@link specificationTableProblems}).
 */
export function specificationConformanceSuites(
  specUris: readonly string[],
  table: Readonly<Record<string, readonly string[]>> = SHARED_SPECIFICATIONS
): readonly ConformanceSuite[] {
  return specUris.flatMap((uri) => {
    const needs = table[sharedSpecificationStem(uri)];
    if (needs === undefined || !needs.every(isNeed)) return [];
    return capabilitiesOf(needs).map((area) => ({
      id: uri,
      area,
      binds: (game: HarnessGame) => offersAll(game, needs),
    }));
  });
}

function isNeed(need: string): need is ConformanceNeed {
  return (
    (GAME_CAPABILITIES as readonly string[]).includes(need) || isTrait(need)
  );
}

/** A cell of the matrix: how one game stands against one area. */
export type ConformanceCell =
  /** The game does not offer the capability: nothing is owed. */
  | { readonly status: 'unsupported' }
  /** Offered, and these shared suites bind the game. */
  | { readonly status: 'bound'; readonly suites: readonly string[] }
  /** Offered, but no shared suite requires a case of it: a failure. */
  | { readonly status: 'missing' };

export type ConformanceRow = {
  readonly game: string;
  readonly cells: Readonly<Record<ConformanceArea, ConformanceCell>>;
};

/**
 * The game × capability matrix, derived only from what each game offers and
 * which shared suites require a case of it: adding a game adds a row, adding
 * a suite fills cells, and an offered capability no suite requires a case
 * of is `missing` — an empty suite file binds nothing.
 */
export function conformanceMatrix(
  games: readonly HarnessGame[],
  suites: readonly ConformanceSuite[]
): readonly ConformanceRow[] {
  return games.map((game) => {
    const cell = (area: ConformanceArea): ConformanceCell => {
      if (!offersAll(game, [area])) return { status: 'unsupported' };
      const bound = suites
        .filter((suite) => suite.area === area && suite.binds(game))
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

/**
 * The registered games and the harness games must be one list: each
 * registered game held by the shared suites with its very definition.
 */
export function enrollmentProblems(
  registered: readonly { readonly id: string }[],
  harness: readonly HarnessGame[]
): readonly string[] {
  const out: string[] = [];
  const harnessIds = new Set(harness.map((game) => game.shared.id));
  const registeredIds = new Set(registered.map((game) => game.id));
  for (const game of registered)
    if (!harnessIds.has(game.id))
      out.push(
        `"${game.id}" is in PLAYABLE_GAME_DEFINITIONS but not HARNESS_GAMES — add its HarnessGame to HARNESS_GAMES (@libs/games-harness-ts/harness-games) so the shared suites hold it`
      );
  for (const game of harness)
    if (!registeredIds.has(game.shared.id))
      out.push(
        `"${game.shared.id}" (${game.label}) is in HARNESS_GAMES but not PLAYABLE_GAME_DEFINITIONS — register its defineGame value, or list a test-only game beside the reference game (tests/conformance-world.ts)`
      );
  if (out.length > 0) return out;
  for (const [index, game] of harness.entries()) {
    const definition = registered[index];
    if (definition?.id !== game.shared.id)
      out.push(
        `HARNESS_GAMES[${String(index)}] is "${game.shared.id}" but PLAYABLE_GAME_DEFINITIONS[${String(index)}] is "${String(definition?.id)}" — list the harness games in registry order`
      );
    else if (definition !== game.shared)
      out.push(
        `"${game.shared.id}": HARNESS_GAMES holds another definition than PLAYABLE_GAME_DEFINITIONS registers — use the registered defineGame value itself`
      );
  }
  return out;
}

/**
 * The table of shared specifications must list each specification of
 * `specs/games/` once, by what it shows, and nothing else.
 */
export function specificationTableProblems(
  table: Readonly<Record<string, readonly string[]>>,
  specUris: readonly string[]
): readonly string[] {
  const out: string[] = [];
  const stems = new Set(specUris.map(sharedSpecificationStem));
  for (const uri of specUris)
    if (table[sharedSpecificationStem(uri)] === undefined)
      out.push(
        `${uri}: list the capabilities it shows in SHARED_SPECIFICATIONS (@libs/games-harness-ts/game-conformance)`
      );
  const traits = Object.keys(GAME_TRAITS).join(', ');
  for (const [stem, needs] of Object.entries(table)) {
    const entry = `SHARED_SPECIFICATIONS["${stem}"]`;
    if (!stems.has(stem))
      out.push(
        `${entry} names no specification in specs/games — remove it, or restore the specification`
      );
    if (needs.length === 0)
      out.push(`${entry} lists nothing — list the capabilities it shows`);
    for (const need of needs)
      if (!isNeed(need))
        out.push(
          `${entry} lists "${need}", which is neither a capability (${GAME_CAPABILITIES.join(', ')}) nor a trait (${traits})`
        );
    if (needs.length > 0 && capabilitiesOf(needs.filter(isNeed)).length === 0)
      out.push(
        `${entry} lists no capability — a specification counts toward the capabilities it shows`
      );
  }
  return out;
}

/** Code suites that require no case of any game they bind. */
export function emptySuiteProblems(
  planned: readonly PlannedCodeSuite[]
): readonly string[] {
  return planned.flatMap((suite) => {
    if (suite.registers === null)
      return [
        `${suite.id} never calls forEveryGame — a conformance suite registers its cases through forEveryGame(import.meta.path, …)`,
      ];
    const bound = Object.keys(suite.registers);
    return bound.length > 0 &&
      bound.every((game) => suite.registers?.[game] !== true)
      ? [
          `${suite.id} registers no case for any game it binds (${bound.join(', ')}) — add its tests inside forEveryGame, or delete it`,
        ]
      : [];
  });
}

/** Offered areas no shared suite or specification requires a case of. */
export function missingEvidenceProblems(
  rows: readonly ConformanceRow[]
): readonly string[] {
  return rows.flatMap((row) =>
    CONFORMANCE_AREAS.filter(
      (area) => row.cells[area].status === 'missing'
    ).map((area) =>
      area === 'rules'
        ? `${row.game} is held to no rules suite — every game is; add one under tests/conformance/rules/`
        : `${row.game} offers ${area} but no shared suite or specification requires a case of it — add a suite under tests/conformance/${area}/ or list a specs/games specification showing it in SHARED_SPECIFICATIONS`
    )
  );
}

/** Everything the conformance plan is derived from. */
export type ConformancePlan = {
  /** `PLAYABLE_GAME_DEFINITIONS`. */
  readonly registered: readonly { readonly id: string }[];
  /** `HARNESS_GAMES`. */
  readonly harness: readonly HarnessGame[];
  /** Every game the shared suites run: the harness games and test-only ones. */
  readonly games: readonly HarnessGame[];
  readonly codeSuites: readonly PlannedCodeSuite[];
  /** Every specification of `specs/games/` a game is held to. */
  readonly specifications: readonly string[];
  readonly table: Readonly<Record<string, readonly string[]>>;
};

/** The plan's matrix and every way it falls short, each saying what to fix. */
export function planConformance(plan: ConformancePlan): {
  readonly matrix: readonly ConformanceRow[];
  readonly problems: readonly string[];
} {
  const matrix = conformanceMatrix(plan.games, [
    ...codeConformanceSuites(plan.codeSuites),
    ...specificationConformanceSuites(plan.specifications, plan.table),
  ]);
  return {
    matrix,
    problems: [
      ...enrollmentProblems(plan.registered, plan.harness),
      ...executionGameProblems(plan.harness, plan.games),
      ...specificationTableProblems(plan.table, plan.specifications),
      ...emptySuiteProblems(plan.codeSuites),
      ...plan.codeSuites.flatMap((suite) =>
        suiteCaseProblems(
          suite,
          plan.games
            .filter((game) =>
              offersAll(game, [suite.area, ...(suite.needs ?? [])])
            )
            .map((game) => game.shared.id)
        )
      ),
      ...missingEvidenceProblems(matrix),
    ],
  };
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
