import { assertProperty } from '@pkgs/property-shared/assert-property';
import type {
  GameRecordMetadata,
  GameRules,
  GameSide,
} from '@pkgs/turn-game-shared/game-rules';
import fc from 'fast-check';
import type { GameLaw } from './game-rules-laws';
import { law, must, picks, walk } from './game-rules-laws';
import type { HarnessGame } from './harness-game';

/**
 * The laws of what the shared screens and records say about a game: its
 * presentation (every game) and its game record (a game whose matched games
 * offer one). As with the rules laws, the expected outcome comes from the
 * contract and the game's fixtures, never from the game agreeing with itself.
 */

const filled = (text: string | undefined): boolean =>
  text !== undefined && text.trim() !== '';

/** The ending reasons of the game's known lines. */
function knownEndings(game: HarnessGame): readonly string[] {
  const rules = game.shared.turnGame.rules;
  return [game.fixtures.firstSideVictory, game.fixtures.drawByRules].flatMap(
    (line) => {
      const reason = line === undefined ? null : lastReason(rules, line);
      return reason === null ? [] : [reason];
    }
  );
}

function lastReason(rules: GameRules, line: readonly string[]): string | null {
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  let reason: string | null = null;
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    if (played === null) return null;
    actions.push(action);
    position = played.position;
    history = played.history;
    reason = played.reason;
  }
  return reason;
}

/** The laws of how the shared screens name a game's sides and endings. */
export function gamePresentationLaws(game: HarnessGame): readonly GameLaw[] {
  const presentation = game.client.presentation;
  return [
    law(game, 'the game and each of its sides have a name of their own', () => {
      must(filled(presentation.name()), 'the game has no name');
      const first = presentation.sideLabel('white');
      const second = presentation.sideLabel('black');
      must(filled(first) && filled(second), 'a side has no name');
      must(first !== second, `both sides are called "${first}"`);
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
      assertProperty(
        `${game.label}: endings`,
        fc.property(picks, (drawn) => {
          const reason = walk(game.shared.turnGame.rules, drawn).steps.at(
            -1
          )?.reason;
          if (reason !== undefined && reason !== null) described(reason);
        })
      );
    }),
    law(game, 'a draw on time is described whichever side ran out', () => {
      for (const side of ['white', 'black'] as const)
        must(
          filled(presentation.timeoutDrawDescription(side)),
          `a draw on time against the ${side === 'white' ? 'first' : 'second'} side has no description`
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
const outcomes: readonly (GameSide | 'draw')[] = ['white', 'black', 'draw'];

/**
 * The laws of a game's record, for a game whose matched games offer one
 * (finding an opponent and history): read back in the game's own format
 * (`readRecord`, written without the game's code), a record names the two
 * people on their sides, the result, the clock choice and every move of
 * this game as its fixtures write them.
 */
export function gameRecordLaws(game: HarnessGame): readonly GameLaw[] {
  const history = game.shared.turnGame.capabilities.history;
  const read = game.readRecord;
  if (history === undefined || read === undefined) return [];
  const rules = game.shared.turnGame.rules;
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
            fc
              .tuple(username, username)
              .filter(([first, second]) => first !== second),
            fc.constantFrom(...outcomes),
            fc.constantFrom(...CLOCKS),
            ([first, second], outcome, clock) => {
              const played = walkLine(rules, line);
              const metadata: GameRecordMetadata = {
                participants: [
                  { name: first, rating: null },
                  { name: second, rating: null },
                ],
                outcome,
                reason: outcome === 'draw' ? 'agreement' : 'resignation',
                timeControl: clock.timeControl,
              };
              const got = read(
                history.record(played.position, played.history, metadata)
              );
              must(
                got.firstSide === first && got.secondSide === second,
                `the record names ${String(got.firstSide)} and ${String(got.secondSide)}, not ${first} and ${second}`
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
