import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { GameFrame } from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  GameRecordMetadata,
  GameRules,
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides, winningSides } from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import type { GameLaw } from './game-rules-laws';
import { knownGamePositions, law, must, picks, walk } from './game-rules-laws';
import type { HarnessGame, TurnHarnessGame } from './harness-game';
import { isTurnHarnessGame } from './harness-game';
import { playedRulesOf, publicPosition } from './played-rules';
import {
  simulationEndingReasons,
  simulationRecordLaws,
} from './simulation-capability-laws';

/**
 * The laws of what the shared screens and records say about a game: its
 * presentation (every game) and its game record (a game whose matched games
 * offer one). As with the rules laws, the expected outcome comes from the
 * contract and the game's fixtures, never from the game agreeing with itself.
 */

const filled = (text: string | undefined): boolean =>
  text !== undefined && text.trim() !== '';

/**
 * The ending reason of each known line the game's rules end — its known
 * victory and, for a game its rules can draw, that draw. A known line its
 * rules refuse, never end, or end without a reason is a fault.
 */
function knownTurnEndings(game: TurnHarnessGame): readonly string[] {
  const rules = playedRulesOf(game);
  const lines = [
    ['known victory', game.fixtures.firstSideVictory],
    ["draw by the game's rules", game.fixtures.drawByRules],
  ] as const;
  return lines.flatMap(([name, line]) =>
    line === undefined ? [] : [endingReason(rules, name, line)]
  );
}

function knownEndings(game: HarnessGame): readonly string[] {
  return [
    ...(isTurnHarnessGame(game) ? knownTurnEndings(game) : []),
    ...simulationEndingReasons(game),
  ];
}

function endingReason(
  rules: GameRules,
  name: string,
  line: readonly string[]
): string {
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    if (played === null) throw new Error(`the ${name}'s ${action} was refused`);
    actions.push(action);
    position = played.position;
    history = played.history;
    if (played.winner === null) continue;
    if (played.reason === null || played.reason.trim() === '')
      throw new Error(`the ${name} ends without a reason`);
    return played.reason;
  }
  throw new Error(`the ${name} never ends the game`);
}

const SIDES = ['white', 'black'] as const;
const sideName = (side: GameSide) => (side === 'white' ? 'first' : 'second');

/**
 * The laws of how the shared screens name a game's sides and endings: the
 * result screens and notices show only what the game's presentation says
 * of how a game ended, so each ending keeps words of its own.
 */
export function gamePresentationLaws(game: HarnessGame): readonly GameLaw[] {
  const presentation = game.client.presentation;
  return [
    law(game, 'the game and each of its sides have a name of their own', () => {
      must(presentation !== undefined, 'the game supplies no presentation');
      must(filled(presentation.name()), 'the game has no name');
      const names = gameSides(game.shared.registration.rules).map((side) =>
        presentation.sideLabel(side)
      );
      must(names.every(filled), 'a side has no name');
      must(new Set(names).size === names.length, 'seated sides share a name');
    }),
    law(game, 'every ending its rules reach is described and labelled', () => {
      const described = (reason: string) => {
        must(
          filled(presentation.endingDescription(reason)),
          `the ending "${reason}" has no description`
        );
        must(
          filled(presentation.endingLabel(reason)),
          `the ending "${reason}" has no label`
        );
      };
      for (const reason of knownEndings(game)) described(reason);
      if (isTurnHarnessGame(game))
        assertProperty(
          `${game.label}: endings`,
          fc.property(picks, (drawn) => {
            const reason = walk(playedRulesOf(game), drawn).steps.at(
              -1
            )?.reason;
            if (reason !== undefined && reason !== null) described(reason);
          })
        );
    }),
    law(game, 'distinct endings keep descriptions of their own', () => {
      const byDescription = new Map<string, string>();
      for (const reason of new Set(knownEndings(game))) {
        const description = presentation.endingDescription(reason) ?? '';
        const earlier = byDescription.get(description);
        must(
          earlier === undefined,
          `the endings "${String(earlier)}" and "${reason}" are both described as "${description}"`
        );
        byDescription.set(description, reason);
      }
    }),
    law(game, 'a reason the game never gives has no description', () => {
      const unknown = `not an ending of ${game.label}`;
      const description = presentation.endingDescription(unknown);
      must(
        description === undefined,
        `the reason "${unknown}" is described as "${String(description)}"`
      );
    }),
    ...(game.shared.capabilities.matchmaking?.clockChoices !== true &&
    !isTurnHarnessGame(game)
      ? []
      : [
          law(
            game,
            'a draw on time is described whichever side ran out',
            () => {
              for (const side of gameSides(game.shared.registration.rules))
                must(
                  filled(presentation.timeoutDrawDescription?.(side)),
                  `a draw on time against the ${sideName(side)} side has no description`
                );
            }
          ),
        ]),
    // A flag fall is a draw only against a side that cannot win, which a
    // game shows by its fixture; a game without one is never drawn on time.
    ...(!isTurnHarnessGame(game) ||
    game.fixtures.secondSideCannotWin === undefined
      ? []
      : [
          law(game, 'a draw on time names the side that ran out', () => {
            const [first, second] = SIDES.map((side) => {
              const description =
                presentation.timeoutDrawDescription?.(side) ?? '';
              must(
                description.includes(presentation.sideLabel(side)),
                `a draw on time against the ${sideName(side)} side ("${description}") does not name ${presentation.sideLabel(side)}`
              );
              return description;
            });
            must(
              first !== second,
              `a draw on time reads "${String(first)}" whichever side ran out`
            );
          }),
        ]),
  ];
}

/** A finished position and who its result went to. */
type Finished = { readonly position: string; readonly winner: GameWinner };

/** The known lines' final positions, and every finished simulation example. */
function knownFinishes(game: HarnessGame): readonly Finished[] {
  const finishes: Finished[] = [];
  if (isTurnHarnessGame(game)) {
    const rules = playedRulesOf(game);
    for (const line of [
      game.fixtures.firstSideVictory,
      game.fixtures.drawByRules,
    ]) {
      if (line === undefined) continue;
      const last = walkLine(rules, line.slice(0, -1));
      const played = rules.play(
        last.position,
        line.at(-1) ?? '',
        last.history,
        line.slice(0, -1)
      );
      if (played?.winner != null)
        finishes.push({
          position: publicPosition(played.position),
          winner: played.winner,
        });
    }
  }
  const simulation = game.shared.registration.simulation;
  for (const example of game.simulationFixtures?.examples ?? []) {
    const state = simulation?.codec.decode(example.expectedPosition);
    const result =
      state === undefined || state === null ? null : simulation!.result(state);
    if (result !== null && result !== undefined)
      finishes.push({
        position: example.expectedPosition,
        winner: result.winner,
      });
  }
  return finishes;
}

/** What the frame says of each seat in `position` is words, or nothing. */
function framesSeats(
  frame: GameFrame<unknown>,
  sides: readonly GameSide[],
  position: string
): void {
  for (const side of sides) {
    const stat = frame.seats.stat(position, side);
    must(
      stat === null || (filled(stat.label) && filled(stat.value)),
      `the ${side} seat's figure is ${JSON.stringify(stat)}`
    );
    for (const committed of [[], sides])
      must(
        frame.seats.facts(position, side, committed).every(filled),
        `a fact of the ${side} seat is empty`
      );
    must(
      typeof frame.seats.out(position, side) === 'boolean',
      `whether the ${side} seat is out is not said`
    );
  }
  for (const viewer of [null, ...sides])
    for (const committed of [[], sides]) {
      const status = frame.turnStatus(position, viewer, committed);
      must(
        status === null || filled(status),
        `the turn line for ${String(viewer)} is empty`
      );
    }
}

/** Each seat once, every winner first and alone in first place. */
function framesResult(
  frame: GameFrame<unknown>,
  sides: readonly GameSide[],
  finished: Finished
): void {
  const summary = frame.result(finished.position, finished.winner);
  const winners = winningSides(finished.winner, sides);
  const seated = summary.standings.map((standing) => standing.side);
  must(
    seated.length === sides.length &&
      sides.every((side) => seated.includes(side)),
    `the result lists ${seated.join(', ')}, not each of ${sides.join(', ')} once`
  );
  for (const standing of summary.standings) {
    const won = winners.includes(standing.side);
    must(
      Number.isInteger(standing.place) &&
        (won ? standing.place === 1 : standing.place > winners.length),
      `the ${standing.side} seat is placed ${String(standing.place)} in a game won by ${winners.join(', ')}`
    );
    must(
      standing.score === null || filled(standing.score),
      `the ${standing.side} seat's score is empty`
    );
  }
  must(
    summary.scoreLabel === null || filled(summary.scoreLabel),
    'the result names its score with nothing'
  );
}

/**
 * The laws of a game's frame: what it says of each seat and of the turn,
 * in every position its rules reach, is words or nothing and never fails;
 * and the result of every finished game lists each seat once, its winners
 * (every seat for a draw) first.
 */
export function gameFrameLaws(game: HarnessGame): readonly GameLaw[] {
  const frame = game.client.presentation?.frame;
  const sides = gameSides(game.shared.registration.rules);
  const finishes = () => knownFinishes(game);
  return [
    law(
      game,
      'the frame tells each seat and the turn in every position',
      () => {
        must(frame !== undefined, 'the game supplies no frame');
        for (const position of knownGamePositions(game))
          framesSeats(frame!, sides, publicPosition(position));
        if (isTurnHarnessGame(game))
          assertProperty(
            `${game.label}: frame seats`,
            fc.property(picks, (drawn) => {
              for (const step of walk(playedRulesOf(game), drawn).steps)
                framesSeats(frame!, sides, publicPosition(step.position));
            })
          );
      }
    ),
    law(game, 'a finished game lists each seat once, its winners first', () => {
      must(frame !== undefined, 'the game supplies no frame');
      for (const finished of finishes()) {
        framesResult(frame!, sides, finished);
        // A draw on time or by agreement goes to every seat.
        framesResult(frame!, sides, { ...finished, winner: 'draw' });
      }
      if (isTurnHarnessGame(game))
        assertProperty(
          `${game.label}: frame result`,
          fc.property(picks, (drawn) => {
            const last = walk(playedRulesOf(game), drawn).steps.at(-1);
            if (last?.winner != null)
              framesResult(frame!, sides, {
                position: publicPosition(last.position),
                winner: last.winner,
              });
          })
        );
    }),
  ];
}

/** Clock choices as finding an opponent writes them, and their metadata. */
const CLOCKS = [
  {
    choice: '5+0',
    timeControl: { minutes: 5, incrementSeconds: 0, daysPerMove: 0 },
  },
  {
    choice: '3d',
    timeControl: { minutes: 3 * 24 * 60, incrementSeconds: 0, daysPerMove: 3 },
  },
] as const;

const username = fc.stringMatching(/^[a-z][a-z0-9]{2,11}$/);

/**
 * The laws of a game's record, for a game whose matched games offer one
 * (finding an opponent and history): read back in the game's own format
 * (`readRecord`, written without the game's code), a record names the two
 * people on their sides, the result, the clock choice and every move of
 * this game as its fixtures write them.
 */
export function gameRecordLaws(game: HarnessGame): readonly GameLaw[] {
  return [
    ...(isTurnHarnessGame(game) ? turnRecordLaws(game) : []),
    ...simulationRecordLaws(game),
  ];
}

function turnRecordLaws(game: TurnHarnessGame): readonly GameLaw[] {
  const history = game.shared.turnGame.capabilities.history;
  const read = game.readRecord;
  if (history === undefined || read === undefined) return [];
  const rules = playedRulesOf(game);
  // The known victory without its winning move: an unfinished game whose
  // result comes from the metadata (resignation, agreement, time).
  const line = game.fixtures.firstSideVictory.slice(0, -1);
  const labels = game.fixtures.firstSideVictoryLabels.slice(0, -1);
  return [
    law(
      game,
      'the game record names both people, the result, the clock choice and every move of this game',
      () =>
        assertProperty(
          `${game.label}: game record`,
          fc.property(
            fc.uniqueArray(username, {
              minLength: gameSides(rules).length,
              maxLength: gameSides(rules).length,
            }),
            fc.constantFrom(...gameSides(rules), 'draw' as const),
            fc.constantFrom(...CLOCKS),
            (people, outcome, clock) => {
              const [first, second] = people;
              const played = walkLine(rules, line);
              const metadata: GameRecordMetadata = {
                participants: people.map((name) => ({ name, rating: null })),
                outcome,
                reason: outcome === 'draw' ? 'agreement' : 'resignation',
                timeControl: clock.timeControl,
              };
              const got = read(
                history.record(
                  publicPosition(played.position),
                  played.history,
                  metadata
                )
              );
              must(
                got.firstSide === first && got.secondSide === second,
                `the record names ${String(got.firstSide)} and ${String(got.secondSide)}, not ${first} and ${second}`
              );
              if (people.length > 2)
                must(
                  JSON.stringify(got.participants) === JSON.stringify(people),
                  'the record omits a declared participant'
                );
              must(
                got.result === outcome,
                `the record gives ${String(got.result)}, not ${outcome}`
              );
              must(
                got.clockChoice === clock.choice,
                `the record gives the clock ${String(got.clockChoice)}, not ${clock.choice}`
              );
              must(
                JSON.stringify(got.moves) === JSON.stringify(labels),
                `the record's moves ${JSON.stringify(got.moves)} are not this game's ${JSON.stringify(labels)}`
              );
            }
          )
        )
    ),
  ];
}

/** The position and history after the accepted `line`. */
function walkLine(rules: GameRules, line: readonly string[]) {
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    must(played !== null, `the known move ${action} was refused`);
    actions.push(action);
    position = played!.position;
    history = played!.history;
  }
  return { position, history };
}
