import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type {
  GameRecordMetadata,
  GameRules,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import type { GameLaw } from './game-rules-laws';
import { law, must, picks, walk } from './game-rules-laws';
import type { HarnessGame } from './harness-game';
import { playedRulesOf } from './played-rules';

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
function knownEndings(game: HarnessGame): readonly string[] {
  const rules = playedRulesOf(game);
  const lines = [
    ['known victory', game.fixtures.firstSideVictory],
    ["draw by the game's rules", game.fixtures.drawByRules],
  ] as const;
  return lines.flatMap(([name, line]) =>
    line === undefined ? [] : [endingReason(rules, name, line)]
  );
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
          const reason = walk(playedRulesOf(game), drawn).steps.at(-1)?.reason;
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
    law(game, 'a draw on time is described whichever side ran out', () => {
      for (const side of SIDES)
        must(
          filled(presentation.timeoutDrawDescription(side)),
          `a draw on time against the ${sideName(side)} side has no description`
        );
    }),
    // A flag fall is a draw only against a side that cannot win, which a
    // game shows by its fixture; a game without one is never drawn on time.
    ...(game.fixtures.secondSideCannotWin === undefined
      ? []
      : [
          law(game, 'a draw on time names the side that ran out', () => {
            const [first, second] = SIDES.map((side) => {
              const description = presentation.timeoutDrawDescription(side);
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
