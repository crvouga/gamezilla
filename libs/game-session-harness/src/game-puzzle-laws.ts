import { admitCataloguePuzzle } from '@libs/game-puzzle-shared/puzzle-catalogue';
import type { PuzzleMoveJudgement } from '@libs/game-puzzle-shared/puzzle-judge';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import {
  positionAt,
  positionTrail,
  setupPuzzle,
} from '@libs/game-puzzle-shared/puzzle-setup';
import type { PuzzleRecord } from '@pkgs/turn-game-shared/game-puzzles';
import type { GameRules } from '@pkgs/turn-game-shared/game-rules';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { GameLaw } from './game-rules-laws';
import { law, must } from './game-rules-laws';
import type { HarnessGame } from './harness-game';
import type { PuzzleFixture, PuzzleFixtureMove } from './known-puzzles';

/**
 * The laws of a game offering puzzles, over its known puzzles
 * (`fixtures.puzzles`): what the platform's catalogue, judge and playback
 * make of each, as the game's author wrote it from the game's own laws.
 * The expected outcome is always the fixture's or the contract's — the
 * positions a line reaches are asked of the game's rules alone, never of the
 * platform's puzzle engine — so a faulty capability (a validation, a
 * spelling, marks) fails them instead of agreeing with itself.
 */

/** The game's rules and puzzles capability, and its known puzzles. */
function puzzlesOf(game: HarnessGame) {
  const puzzles = game.shared.turnGame.capabilities.puzzles;
  const known = game.fixtures.puzzles;
  if (puzzles === undefined || known === undefined) return null;
  const puzzleGame: PuzzleGame = { rules: game.shared.turnGame.rules, puzzles };
  return { puzzleGame, known };
}

/** The positions of the line, its starting position first, by the rules alone. */
export function rulesTrail(
  rules: GameRules,
  record: PuzzleRecord
): readonly string[] {
  const trail = [record.position];
  for (const action of record.line) {
    const played = rules.play(trail.at(-1) ?? '', action, '', []);
    if (played === null) break;
    trail.push(played.position);
  }
  return trail;
}

/** The platform's verdict on `move`, the line followed up to it. */
function judged(
  puzzleGame: PuzzleGame,
  fixture: PuzzleFixture,
  move: PuzzleFixtureMove
): PuzzleMoveJudgement {
  return judgePuzzleAction({
    game: puzzleGame,
    position: rulesTrail(puzzleGame.rules, fixture.record)[move.at] ?? '',
    line: fixture.record.line,
    idx: move.at,
    solverSide: fixture.solverSide,
    action: move.action,
  });
}

const kindOf = (verdict: PuzzleMoveJudgement) =>
  verdict.kind === 'correct' ? `correct (${verdict.via})` : verdict.kind;

/** The catalogue key the platform stores `record` under. */
function catalogueKey(game: HarnessGame, record: PuzzleRecord): string {
  const admission = admitCataloguePuzzle(
    createTurnGames([game.shared.turnGame]),
    { record, source: { url: null, tags: [] } }
  );
  if (!admission.ok) throw new Error(admission.detail);
  return admission.row.position_key;
}

/** The other games offering puzzles, with their known puzzles. */
function puzzleOffering(
  game: HarnessGame,
  others: readonly HarnessGame[]
): readonly HarnessGame[] {
  return others.filter(
    (other) =>
      other.shared.id !== game.shared.id &&
      other.shared.turnGame.capabilities.puzzles !== undefined
  );
}

/** `record` re-filed under `namespace`, as an import mixing games would. */
function filedUnder(
  record: PuzzleRecord,
  namespace: string,
  tag: string
): PuzzleRecord {
  return { ...record, id: `${namespace}${tag}` };
}

function ownPuzzlesLaw(
  game: HarnessGame,
  puzzleGame: PuzzleGame,
  known: readonly PuzzleFixture[]
): GameLaw {
  return law(
    game,
    'each known puzzle is one of its own puzzles, in its own namespace',
    () => {
      const unprefixed = game.shared.turnGame.unprefixedNamespace === true;
      const namespace = puzzleGame.puzzles.namespace;
      must(
        namespace === (unprefixed ? '' : `${game.shared.id}/`),
        `its puzzle namespace is "${namespace}"`
      );
      for (const { record } of known) {
        const verdict = puzzleGame.puzzles.content.validate(record);
        must(
          verdict.ok,
          `its own known puzzle ${record.id} is refused: ${verdict.ok ? '' : `${verdict.reason}: ${verdict.detail}`}`
        );
      }
    }
  );
}

function othersRefusedLaw(
  game: HarnessGame,
  puzzleGame: PuzzleGame,
  others: readonly HarnessGame[]
): GameLaw {
  return law(
    game,
    "its content validation refuses every other game's known puzzle",
    () => {
      const namespace = puzzleGame.puzzles.namespace;
      for (const other of puzzleOffering(game, others))
        for (const [index, { record }] of (
          other.fixtures.puzzles ?? []
        ).entries()) {
          const filed = filedUnder(
            record,
            namespace,
            `from-${other.shared.id}-${index}`
          );
          must(
            !puzzleGame.puzzles.content.validate(filed).ok,
            `it accepts ${other.label}'s known puzzle ${record.id} as its own`
          );
        }
    }
  );
}

function recognisedLaw(
  game: HarnessGame,
  known: readonly PuzzleFixture[],
  others: readonly HarnessGame[]
): GameLaw {
  return law(game, 'a known puzzle is recognised by its own game alone', () => {
    const rules = game.shared.turnGame.rules;
    for (const { record } of known) {
      must(
        rules.recognizes(record.position),
        `${record.id}'s position is not recognised`
      );
      for (const other of others)
        if (other.shared.id !== game.shared.id)
          must(
            !other.shared.turnGame.rules.recognizes(record.position),
            `${other.label} claims ${record.id}'s position`
          );
    }
  });
}

function admissionLaw(
  game: HarnessGame,
  known: readonly PuzzleFixture[],
  others: readonly HarnessGame[]
): GameLaw {
  return law(
    game,
    'the catalogue admits each known puzzle into its own namespace alone',
    () => {
      const offering = puzzleOffering(game, others);
      const games = createTurnGames([
        game.shared.turnGame,
        ...offering.map((other) => other.shared.turnGame),
      ]);
      for (const { record } of known) {
        const own = admitCataloguePuzzle(games, {
          record,
          source: { url: null, tags: [] },
        });
        must(
          own.ok && own.row.id === record.id,
          `${record.id} is not admitted as itself: ${own.ok ? own.row.id : own.detail}`
        );
        for (const other of offering) {
          const namespace =
            other.shared.turnGame.capabilities.puzzles?.namespace ?? '';
          const filed = filedUnder(record, namespace, `from-${game.shared.id}`);
          must(
            !admitCataloguePuzzle(games, {
              record: filed,
              source: { url: null, tags: [] },
            }).ok,
            `${record.id} is admitted into ${other.label}'s namespace`
          );
        }
      }
    }
  );
}

function duplicatesLaw(
  game: HarnessGame,
  known: readonly PuzzleFixture[]
): GameLaw {
  return law(
    game,
    'duplicates of a known puzzle share one catalogue key, and different puzzles do not',
    () => {
      const keys = new Map<string, string>();
      for (const { record } of known) {
        const key = catalogueKey(game, record);
        must(
          catalogueKey(game, { ...record, id: `${record.id}x` }) === key,
          `a copy of ${record.id} under another id is not its duplicate`
        );
        const same = keys.get(key);
        must(
          same === undefined,
          `${String(same)} and ${record.id} share the key ${key}`
        );
        keys.set(key, record.id);
      }
    }
  );
}

/**
 * The content laws: its own puzzles in its own namespace, refusing every
 * other game's, recognised by it alone, admitted into its namespace alone,
 * and deduplicated by their key.
 */
export function gamePuzzleContentLaws(
  game: HarnessGame,
  others: readonly HarnessGame[]
): readonly GameLaw[] {
  const of = puzzlesOf(game);
  if (of === null) return [];
  return [
    ownPuzzlesLaw(game, of.puzzleGame, of.known),
    othersRefusedLaw(game, of.puzzleGame, others),
    recognisedLaw(game, of.known, others),
    admissionLaw(game, of.known, others),
    duplicatesLaw(game, of.known),
  ];
}

/** Following the solution: each move as the line names it, ending on the last. */
function solutionFollows(puzzleGame: PuzzleGame, fixture: PuzzleFixture): void {
  const { record } = fixture;
  const setup = setupPuzzle(puzzleGame, record.position, record.line);
  must(setup.kind === 'ready', `${record.id} is set up as invalid`);
  if (setup.kind !== 'ready') return;
  must(
    setup.solverSide === fixture.solverSide,
    `${record.id} is solved by ${setup.solverSide}, not ${fixture.solverSide}`
  );
  const trail = rulesTrail(puzzleGame.rules, record);
  for (const [index, action] of fixture.solution.entries()) {
    const at = 2 * index + 1;
    const verdict = judged(puzzleGame, fixture, { at, action });
    const last = at === record.line.length - 1;
    const followed =
      verdict.kind === 'correct' &&
      (verdict.via === 'line' || (last && verdict.via === 'win'));
    must(
      followed,
      `${record.id}: the solution's ${action} is judged ${kindOf(verdict)}`
    );
    if (verdict.kind !== 'correct') return;
    must(
      verdict.label === fixture.labels[at],
      `${record.id}: the solution's ${action} is labelled ${verdict.label}, not ${String(fixture.labels[at])}`
    );
    must(
      verdict.position === trail[at + 1],
      `${record.id}: the solution's ${action} reaches ${verdict.position}, not ${String(trail[at + 1])}`
    );
    must(
      verdict.ends === last,
      `${record.id}: the puzzle ${last ? 'goes on after' : 'ends at'} ${action}`
    );
  }
}

/** Every move its rules allow at each solver move of the line is judged. */
function legalJudged(puzzleGame: PuzzleGame, fixture: PuzzleFixture): void {
  const trail = rulesTrail(puzzleGame.rules, fixture.record);
  for (let at = 1; at < fixture.record.line.length; at += 2)
    for (const action of puzzleGame.rules.legal(trail[at] ?? ''))
      must(
        judged(puzzleGame, fixture, { at, action }).kind !== 'illegal',
        `${fixture.record.id}: the legal ${action} is refused as no move`
      );
}

function wonAnotherWay(
  puzzleGame: PuzzleGame,
  fixture: PuzzleFixture,
  move: PuzzleFixtureMove
): void {
  const verdict = judged(puzzleGame, fixture, move);
  must(
    verdict.kind === 'correct' && verdict.via === 'win' && verdict.ends,
    `${fixture.record.id}: the other win ${move.action} is judged ${kindOf(verdict)}`
  );
  const line = [...fixture.record.line.slice(0, move.at), move.action];
  must(
    verdict.kind === 'correct' &&
      JSON.stringify(verdict.line) === JSON.stringify(line),
    `${fixture.record.id}: the other win does not end the line there`
  );
}

function transposes(
  puzzleGame: PuzzleGame,
  fixture: PuzzleFixture,
  move: PuzzleFixtureMove
): void {
  const verdict = judged(puzzleGame, fixture, move);
  must(
    verdict.kind === 'correct' &&
      verdict.via === 'transposition' &&
      !verdict.ends,
    `${fixture.record.id}: the transposition ${move.action} is judged ${kindOf(verdict)}`
  );
  const line = [...fixture.record.line];
  [line[move.at], line[move.at + 2]] = [
    line[move.at + 2] ?? '',
    line[move.at] ?? '',
  ];
  must(
    verdict.kind === 'correct' &&
      JSON.stringify(verdict.line) === JSON.stringify(line),
    `${fixture.record.id}: the transposition does not reorder the line`
  );
}

/** A law over every known puzzle having a trait, present only if one has it. */
type TraitLaw = {
  readonly name: string;
  readonly trait: (fixture: PuzzleFixture) => PuzzleFixtureMove | undefined;
  readonly check: (fixture: PuzzleFixture, move: PuzzleFixtureMove) => void;
};

function traitLaws(
  game: HarnessGame,
  known: readonly PuzzleFixture[],
  laws: readonly TraitLaw[]
): readonly GameLaw[] {
  return laws.flatMap(({ name, trait, check }) => {
    const having = known.flatMap((fixture) => {
      const move = trait(fixture);
      return move === undefined ? [] : [{ fixture, move }];
    });
    if (having.length === 0) return [];
    return [
      law(game, name, () => {
        for (const { fixture, move } of having) check(fixture, move);
      }),
    ];
  });
}

/**
 * The judge's laws: the solution follows the line and solves the puzzle on
 * its last move; the wrong move is wrong, the refused move no move, every
 * legal move judged; and, for a game whose puzzles show them, a win off the
 * line solves at once and a transposed move continues the reordered line.
 */
export function gamePuzzleJudgeLaws(game: HarnessGame): readonly GameLaw[] {
  const of = puzzlesOf(game);
  if (of === null) return [];
  const { puzzleGame, known } = of;
  const each = (check: (fixture: PuzzleFixture) => void) => () => {
    for (const fixture of known) check(fixture);
  };
  return [
    law(
      game,
      'following the solution solves the puzzle, each move as the line names it',
      each((fixture) => solutionFollows(puzzleGame, fixture))
    ),
    law(
      game,
      'its wrong move is judged wrong',
      each((fixture) => {
        const verdict = judged(puzzleGame, fixture, fixture.wrongMove);
        must(
          verdict.kind === 'wrong',
          `${fixture.record.id}: the wrong move ${fixture.wrongMove.action} is judged ${kindOf(verdict)}`
        );
      })
    ),
    law(
      game,
      "its refused move and its opponent's move are no move",
      each((fixture) => {
        for (const [name, move] of [
          ['refused move', fixture.refusedMove],
          ["opponent's move", fixture.opponentMove],
        ] as const) {
          const verdict = judged(puzzleGame, fixture, move);
          must(
            verdict.kind === 'illegal',
            `${fixture.record.id}: the ${name} ${move.action} is judged ${kindOf(verdict)}`
          );
        }
      })
    ),
    law(
      game,
      'every move its rules allow is judged, never refused',
      each((fixture) => legalJudged(puzzleGame, fixture))
    ),
    ...traitLaws(game, known, [
      {
        name: 'a win off the line solves the puzzle at once',
        trait: (fixture) => fixture.wonAnotherWay,
        check: (fixture, move) => wonAnotherWay(puzzleGame, fixture, move),
      },
      {
        name: 'a transposed solver move continues the reordered line',
        trait: (fixture) => fixture.transposition,
        check: (fixture, move) => transposes(puzzleGame, fixture, move),
      },
    ]),
  ];
}

/** The cells `action` names at `position`, each a cell of the board. */
function namesCells(
  puzzleGame: PuzzleGame,
  position: string,
  action: string
): void {
  const marks = puzzleGame.puzzles.marks(position, action);
  must(marks !== null, `${action} names no cells`);
  if (marks === null) return;
  must(
    puzzleGame.puzzles.isCell(marks.to),
    `${action} ends on ${marks.to}, not a cell`
  );
  if (marks.from !== null)
    must(
      puzzleGame.puzzles.isCell(marks.from),
      `${action} starts on ${marks.from}, not a cell`
    );
}

/**
 * The playback laws: the platform replays each line as its rules play it,
 * and a hint, a wrong move and a suggestion name cells of the board.
 */
export function gamePuzzlePlaybackLaws(game: HarnessGame): readonly GameLaw[] {
  const of = puzzlesOf(game);
  if (of === null) return [];
  const { puzzleGame, known } = of;
  return [
    law(game, 'the line replays as its rules play it', () => {
      for (const { record } of known) {
        const trail = rulesTrail(puzzleGame.rules, record);
        const replayed = positionTrail(
          puzzleGame,
          record.position,
          record.line,
          record.line.length
        );
        must(
          JSON.stringify(replayed) === JSON.stringify(trail.slice(1)),
          `${record.id} replays to other positions`
        );
        must(
          positionAt(puzzleGame, record.position, record.line, 1) === trail[1],
          `${record.id} is not set up at its setup move`
        );
      }
    }),
    law(
      game,
      'a hint, a wrong move and a suggestion name cells of its board',
      () => {
        for (const fixture of known) {
          const trail = rulesTrail(puzzleGame.rules, fixture.record);
          for (const [index, action] of fixture.solution.entries())
            namesCells(puzzleGame, trail[2 * index + 1] ?? '', action);
          namesCells(
            puzzleGame,
            trail[fixture.wrongMove.at] ?? '',
            fixture.wrongMove.action
          );
        }
        for (const junk of ['', 'not a cell at all'])
          must(
            !puzzleGame.puzzles.isCell(junk),
            `"${junk}" is taken for a cell`
          );
      }
    ),
  ];
}

/** Every puzzle law of `game`, among the `others` whose puzzles it must refuse. */
export function gamePuzzleLaws(
  game: HarnessGame,
  others: readonly HarnessGame[]
): readonly GameLaw[] {
  return [
    ...gamePuzzleContentLaws(game, others),
    ...gamePuzzleJudgeLaws(game),
    ...gamePuzzlePlaybackLaws(game),
  ];
}
