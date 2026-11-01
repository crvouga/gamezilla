import { DEFAULT_BOT_DIFFICULTY } from '@libs/game-session-shared-ts/custom-game-state';
import {
  type AssertPropertyParams,
  assertProperty,
} from '@pkgs/property-shared-ts/assert-property';
import type {
  BotDifficulty,
  GameRules,
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides, plainWinner } from '@pkgs/turn-game-shared-ts/game-rules';
import fc from 'fast-check';
import type { HarnessGame, TurnHarnessGame } from './harness-game';
import { isTurnHarnessGame } from './harness-game';
import {
  committedProposal,
  playedRules,
  playedRulesOf,
  scriptedRandom,
  splitDealtPosition,
} from './played-rules';

/**
 * One law a game's rules keep: a named check that throws, naming the game,
 * when the game breaks it. The shared suites run every law for every game;
 * because each law's expected outcome comes from the game's fixtures or the
 * contract itself, a faulty game fails it rather than agreeing with itself.
 */
export type GameLaw = { readonly name: string; readonly check: () => void };

/** The furthest a drawn walk goes; a game may finish sooner. */
const WALK_PLIES = 40;
/** How far two bots play in one drawn game. */
const BOT_PLIES = 30;

type Step = {
  readonly position: string;
  /** The side to move after this action (`PlayedPosition.turn`). */
  readonly turn: GameSide;
  readonly label: string;
  readonly winner: GameWinner | null;
  readonly reason: string | null;
};

/** A law of `game` named `name`: `check` throws when the game breaks it. */
export function law(
  game: Pick<HarnessGame, 'label'>,
  name: string,
  check: () => void
): GameLaw {
  return {
    name,
    check: () => {
      try {
        check();
      } catch (cause) {
        throw new Error(`${game.label} breaks "${name}"`, { cause });
      }
    },
  };
}

/** Fail with `problem` unless the law `holds`. */
export function must(holds: boolean, problem: string): void {
  if (!holds) throw new Error(problem);
}

/**
 * Whether every side commits at `position`: a bot's choice there is the
 * seats' combined commitments, each held to its side's own hand when played.
 */
function committingAt(game: TurnHarnessGame, position: string): boolean {
  const commit = game.shared.turnGame.rules.hands?.commit;
  return (
    commit !== undefined &&
    commit.sides(splitDealtPosition(position).position).length > 0
  );
}

/**
 * What a side may propose at `position` of `game`'s played rules, as the
 * game's own judge sees it: one of `legal` for most games; for a game with
 * dealt hands (whose `legal` is a bounded sample of what a hand allows),
 * any proposal its authority accepts.
 */
function offered(
  game: TurnHarnessGame,
  played: { readonly rules: GameRules; readonly position: string },
  action: string,
  accepted: () => boolean
): boolean {
  const hands = game.shared.turnGame.rules.hands;
  if (hands === undefined)
    return played.rules.legal(played.position).includes(action);
  // While every side commits, a seat's choice is its own commitment.
  const at = splitDealtPosition(played.position);
  const committing = hands.commit?.sides(at.position) ?? [];
  if (committing.length > 0) {
    const side = committing[0]!;
    return (
      'commitment' in
      hands.commit!.accept(
        at.position,
        side,
        hands.hand(at.hidden, side),
        action
      )
    );
  }
  return accepted();
}

/**
 * The public position and the deciding side's own hand at a played-rules
 * position: the side to move, or, while every side commits, the first side
 * still to commit.
 */
function seat(
  game: TurnHarnessGame,
  position: string
): { readonly position: string; readonly hand: string | null } {
  const hands = game.shared.turnGame.rules.hands;
  if (hands === undefined) return { position, hand: null };
  const at = splitDealtPosition(position);
  const side = hands.commit?.sides(at.position)[0] ?? at.turn;
  return { position: at.position, hand: hands.hand(at.hidden, side) };
}

/**
 * What the deciding seats propose at a played-rules position, each from its
 * own hand: the side to move's choice or, while every side commits, every
 * committing side's commitment together, as the law view plays one phase.
 */
function seatsProposal(
  game: TurnHarnessGame,
  position: string,
  choose: (position: string, hand: string | null) => string | null
): string | null {
  const hands = game.shared.turnGame.rules.hands;
  if (hands === undefined) return choose(position, null);
  const at = splitDealtPosition(position);
  const committing = hands.commit?.sides(at.position) ?? [];
  if (committing.length === 0)
    return choose(at.position, hands.hand(at.hidden, at.turn));
  const commitments = committing.map((side) =>
    choose(at.position, hands.hand(at.hidden, side))
  );
  return commitments.some((commitment) => commitment === null)
    ? null
    : committedProposal(commitments as string[]);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The game from its start, taking the `picks`-th legal action each turn. */
export function walk(rules: GameRules, picks: readonly number[]) {
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  const steps: Step[] = [];
  for (const pick of picks) {
    const legal = rules.legal(position);
    if (legal.length === 0) break;
    const action = legal[pick % legal.length]!;
    const played = rules.play(position, action, history, actions);
    must(
      played !== null,
      `the legal action ${action} was refused at ${position}`
    );
    actions.push(action);
    position = played!.position;
    history = played!.history;
    steps.push({
      position,
      turn: played!.turn,
      label: played!.label,
      winner: played!.winner,
      reason: played!.reason,
    });
    if (played!.winner !== null) break;
  }
  return { actions, steps, position, history };
}

/** Choices of a drawn walk (`walk`): the legal action each turn takes. */
export const picks = fc.array(fc.nat(), { maxLength: WALK_PLIES });
const draw = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });
/** Actions a person, a stale client or a hostile one might send. */
const strangers = fc.oneof(
  fc.string({ maxLength: 6 }),
  fc.stringMatching(/^[a-h][1-8][a-h][1-8][a-z]?$/),
  fc.stringMatching(/^-?[0-9]{1,2}$/)
);

/** Independent known positions from every execution capability the game offers. */
export function knownGamePositions(game: HarnessGame): readonly string[] {
  const positions = [game.shared.registration.rules.initial()];
  if (isTurnHarnessGame(game)) {
    const rules = playedRulesOf(game);
    const line = game.fixtures.firstSideVictory;
    positions.push(
      ...Array.from({ length: line.length + 1 }, (_, ply) =>
        rules.replay(line, ply)
      )
    );
  }
  for (const example of game.simulationFixtures?.examples ?? [])
    positions.push(example.initialPosition, example.expectedPosition);
  return positions;
}

/**
 * Near misses of the legal actions — an extra or missing character, another
 * case, stray spaces — which a lenient parser would take for a legal move.
 */
function misspellings(legal: readonly string[]): readonly string[] {
  return legal
    .slice(0, 6)
    .flatMap((action) => [
      ...['a', 'q', '!', '0', ' '].map((suffix) => `${action}${suffix}`),
      action.slice(0, -1),
      ` ${action}`,
      action.toUpperCase(),
    ])
    .filter((candidate) => !legal.includes(candidate));
}

/** The fixtures' known line, which only its last move wins, and then nothing. */
function knownVictory(game: TurnHarnessGame): void {
  const rules = playedRulesOf(game);
  const victory = game.fixtures.firstSideVictory;
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const [index, action] of victory.entries()) {
    const played = rules.play(position, action, history, actions);
    must(played !== null, `the known move ${action} was refused`);
    const last = index === victory.length - 1;
    must(
      played!.winner === (last ? 'white' : null),
      last ? 'the known victory did not win' : `${action} ended the game early`
    );
    actions.push(action);
    position = played!.position;
    history = played!.history;
  }
  for (const action of [
    ...rules.legal(position),
    ...victory,
    ...game.fixtures.refusedOpenings,
  ])
    must(
      rules.play(position, action, history, actions) === null,
      `a won game accepted ${action}`
    );
  must(
    rules.replay(actions, actions.length) === position,
    'replaying the known victory reached another position'
  );
}

/**
 * Sides take turns: the first side moves first, and every action of an
 * unfinished duel gives the turn to the other side. Custom and matched
 * games require it (`specs/games/game-turns.feature` and the matched-game
 * models). Puzzle-only consumers are held to their declared line layout
 * by the puzzle laws. A duel whose turns do not alternate is refused here
 * rather than deep inside a shared specification
 * (`tests/probes/turn-order.test.ts`).
 */
function takesTurns(game: TurnHarnessGame): void {
  const rules = playedRulesOf(game);
  assertProperty(
    `${game.label}: sides take turns`,
    fc.property(picks, (drawn) => {
      const played = walk(rules, drawn);
      let mover: GameSide = 'white';
      for (const [ply, step] of played.steps.entries()) {
        // A finished game has no side to move.
        if (step.winner !== null) return;
        const sides = gameSides(rules);
        const other: GameSide =
          sides[(sides.indexOf(mover) + 1) % sides.length]!;
        must(
          step.turn === other,
          `after ${mover}'s ${String(played.actions[ply])} at ply ${String(ply + 1)} it is ${String(step.turn)}'s turn, not ${other}'s`
        );
        mover = other;
      }
    })
  );
}

/**
 * Only experiences whose shared specifications promise alternating
 * participants, and only for a game whose turns rotate: a game whose rules
 * name the next side (`turnOrder: 'rules'`, a trick's winner leading) is
 * held to the side its rules name, which every custom game seats.
 */
function duelRulesLaws(game: TurnHarnessGame): readonly GameLaw[] {
  const offered = game.shared.turnGame.capabilities;
  if (
    offered['custom-games'] === undefined &&
    offered.matchmaking === undefined
  )
    return [];
  const rotating = game.shared.turnGame.rules.turnOrder !== 'rules';
  return [
    ...(rotating
      ? [
          law(
            game,
            'the first side moves first and every action passes the turn to the next declared side',
            () => takesTurns(game)
          ),
        ]
      : []),
    law(game, 'a side cannot win only where the game names a line to it', () =>
      cannotWinOnlyWhereKnown(game)
    ),
    law(game, 'every turn and every result names the seats of the game', () =>
      namesItsSeats(game)
    ),
  ];
}

/** Whether `winner` is a draw, one seat, or distinct seats of the game. */
function resultOfSeats(winner: GameWinner, sides: readonly GameSide[]) {
  if (typeof winner === 'string')
    return winner === 'draw' || sides.includes(winner);
  return (
    winner.length > 0 &&
    new Set(winner).size === winner.length &&
    winner.every((side) => sides.includes(side))
  );
}

/**
 * The side to move is always a declared seat (the only check a game whose
 * rules name the next side has), and a result names only seats, at least
 * one, each once. A matched game ends with one winner or a draw: ratings
 * compare one winner.
 */
function namesItsSeats(game: TurnHarnessGame): void {
  const rules = playedRulesOf(game);
  const sides = gameSides(rules);
  const matched = game.shared.turnGame.capabilities.matchmaking !== undefined;
  assertProperty(
    `${game.label}: turns and results name its seats`,
    fc.property(picks, (drawn) => {
      for (const step of walk(rules, drawn).steps) {
        must(
          sides.includes(step.turn),
          `the turn at ${step.position} goes to ${step.turn}, not a seat of the game`
        );
        if (step.winner === null) continue;
        must(
          resultOfSeats(step.winner, sides),
          `the result at ${step.position} names ${JSON.stringify(step.winner)}, not seats of the game`
        );
        must(
          !matched || typeof plainWinner(step.winner, sides) === 'string',
          `the matched result at ${step.position} has several winners`
        );
      }
    })
  );
}

/**
 * A side can lose its chance to win only where the game says so: with no
 * known line where the second side cannot win, both sides can still win
 * wherever bounded play goes; with one, its end is such a position, and
 * both sides can win at the start.
 */
function cannotWinOnlyWhereKnown(game: TurnHarnessGame): void {
  const rules = playedRulesOf(game);
  const both = (position: string) =>
    gameSides(rules).every((side) => rules.canWin(position, side));
  must(both(rules.initial()), 'a side cannot win from the starting position');
  const line = game.fixtures.secondSideCannotWin;
  if (line !== undefined) {
    const end = rules.replay(line, line.length);
    must(
      !rules.canWin(end, 'black') && rules.canWin(end, 'white'),
      'the known line leaves the second side able to win, or the first not'
    );
    return;
  }
  assertProperty(
    `${game.label}: every side can win`,
    fc.property(picks, (drawn) => {
      for (const step of walk(rules, drawn).steps)
        must(
          step.winner !== null || both(step.position),
          `a side cannot win at ${step.position}, which the game names no line to`
        );
    })
  );
}

/**
 * A game is drawn by its own rules only where the game says so: with no
 * known line its rules draw, bounded play never reaches a draw; with one,
 * its end is a draw.
 */
function drawnOnlyWhereKnown(game: TurnHarnessGame): void {
  const rules = playedRulesOf(game);
  const sides = gameSides(rules);
  // A result naming every seat is a draw too.
  const isDraw = (winner: GameWinner | null) =>
    winner !== null &&
    resultOfSeats(winner, sides) &&
    plainWinner(winner, sides) === 'draw';
  const line = game.fixtures.drawByRules;
  if (line !== undefined) {
    must(
      isDraw(walkLine(rules, line)),
      'the known line its rules draw does not draw'
    );
    return;
  }
  assertProperty(
    `${game.label}: never drawn by its rules`,
    fc.property(picks, (drawn) => {
      for (const step of walk(rules, drawn).steps)
        must(
          !isDraw(step.winner),
          `its rules drew at ${step.position}, which the game names no line to`
        );
    })
  );
}

/** How the known `line` ends: the result of its last action, if accepted. */
function walkLine(
  rules: GameRules,
  line: readonly string[]
): GameWinner | null {
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  let winner: GameWinner | null = null;
  for (const action of line) {
    const played = rules.play(position, action, history, actions);
    if (played === null) return null;
    actions.push(action);
    position = played.position;
    history = played.history;
    winner = played.winner;
  }
  return winner;
}

/** A number source cycling through drawn numbers. */
function cycling(draws: readonly number[]): () => number {
  let next = 0;
  return () => draws[next++ % draws.length]!;
}
const draws = fc.array(draw, { minLength: 1, maxLength: 12 });

/** Two setups drawn by the game itself, one for each side. */
function drawnSetups(
  setup: NonNullable<GameRules['setup']>,
  white: readonly number[],
  black: readonly number[]
) {
  return {
    white: setup.random(cycling(white)),
    black: setup.random(cycling(black)),
  };
}

/**
 * The laws of a game with private setups, whatever setups its sides
 * prepare: the game draws only complete setups, every proposal it offers
 * resolves to a public action its rules accept, nothing else resolves, and
 * no position or label it shows spells out a setup.
 */
function privateSetupLaws(game: TurnHarnessGame): readonly GameLaw[] {
  const rules = game.shared.turnGame.rules;
  const setup = rules.setup;
  if (setup === undefined) return [];
  return [
    law(game, 'every random setup is one complete setup', () =>
      assertProperty(
        `${game.label}: random setups`,
        fc.property(draws, (drawn) => {
          const chosen = setup.random(cycling(drawn));
          must(
            setup.accept(chosen) === chosen,
            `${chosen} is not one complete setup`
          );
        })
      )
    ),
    law(
      game,
      'whatever the setups, every proposal offered resolves to a public action, and nothing else resolves',
      () =>
        assertProperty(
          `${game.label}: resolution`,
          fc.property(
            draws,
            draws,
            picks,
            fc.array(strangers, { maxLength: 6 }),
            (white, black, drawn, sent) => {
              const setups = drawnSetups(setup, white, black);
              const played = walk(playedRules(rules, setups), drawn);
              const legal = rules.legal(played.position);
              for (const proposal of [...sent, ...misspellings(legal)])
                must(
                  legal.includes(proposal) ||
                    setup.resolve(played.position, proposal, setups) === null,
                  `${proposal}, which is not offered, resolved at ${played.position}`
                );
            }
          )
        )
    ),
    law(game, 'no position or label it shows spells out a setup', () =>
      assertProperty(
        `${game.label}: public positions`,
        fc.property(draws, draws, picks, (white, black, drawn) => {
          const setups = drawnSetups(setup, white, black);
          for (const step of walk(playedRules(rules, setups), drawn).steps)
            for (const hidden of [setups.white, setups.black])
              must(
                !step.position.includes(hidden) && !step.label.includes(hidden),
                `${step.position} shows a setup`
              );
        })
      )
    ),
  ];
}

/**
 * The laws of a game with dealt hands: whatever the authority draws, it
 * deals a hidden state that shows every side a hand; every proposal it
 * offers a hand resolves to a public action its rules accept; and the same
 * deal and proposals always resolve alike.
 */
function dealtHandsLaws(game: TurnHarnessGame): readonly GameLaw[] {
  const rules = game.shared.turnGame.rules;
  const hands = rules.hands;
  if (hands === undefined) return [];
  return [
    law(game, 'every deal shows each side a hand of its own', () =>
      assertProperty(
        `${game.label}: deals`,
        fc.property(draws, (drawn) => {
          const hidden = hands.deal(rules.initial(), scriptedRandom(drawn));
          must(
            hands.deal(rules.initial(), scriptedRandom(drawn)) === hidden,
            'the same draws dealt differently'
          );
          for (const side of gameSides(rules)) hands.hand(hidden, side);
        })
      )
    ),
    law(
      game,
      'every proposal a hand is offered resolves to a public action',
      () => {
        const played = playedRulesOf(game);
        assertProperty(
          `${game.label}: offered proposals`,
          fc.property(picks, (drawn) => {
            const walked = walk(played, drawn);
            for (const proposal of played.legal(walked.position))
              must(
                played.play(
                  walked.position,
                  proposal,
                  walked.history,
                  walked.actions
                ) !== null,
                `the offered ${proposal} was refused at ${walked.position}`
              );
          })
        );
      }
    ),
  ];
}

/**
 * Every law of a turn game's rules, for `game`, among the `others` whose
 * positions it must never claim.
 */
export function gameRulesLaws(
  game: TurnHarnessGame,
  others: readonly HarnessGame[]
): readonly GameLaw[] {
  const rules = playedRulesOf(game);
  return [
    law(
      game,
      'the known victory finishes the game for the first side and nothing follows it',
      () => knownVictory(game)
    ),
    law(game, 'the known refused openings are refused', () => {
      for (const action of game.fixtures.refusedOpenings) {
        must(
          rules.play(rules.initial(), action, '', []) === null,
          `the opening ${action} was accepted`
        );
        must(
          !rules.legal(rules.initial()).includes(action),
          `the opening ${action} is offered as legal`
        );
      }
    }),
    law(
      game,
      'every position a game reaches is recognized as this game alone',
      () => {
        for (const other of others)
          for (const position of knownGamePositions(other))
            must(
              !rules.recognizes(position),
              `it claims ${other.label}'s ${position}`
            );
        assertProperty(
          `${game.label}: positions name one game`,
          fc.property(picks, (drawn) => {
            for (const position of [
              rules.initial(),
              ...walk(rules, drawn).steps.map((step) => step.position),
            ]) {
              must(rules.recognizes(position), `${position} is not recognized`);
              for (const other of others)
                must(
                  !other.shared.registration.rules.recognizes(position),
                  `${other.label} claims ${position}`
                );
            }
          })
        );
      }
    ),
    law(
      game,
      'replaying the accepted actions reproduces every position, deterministically',
      () =>
        assertProperty(
          `${game.label}: replay`,
          fc.property(picks, (drawn) => {
            const first = walk(rules, drawn);
            must(
              same(walk(rules, drawn), first),
              'the same actions played differently'
            );
            must(
              rules.replay(first.actions, 0) === rules.initial(),
              'replaying nothing is not the start'
            );
            for (const [ply, step] of first.steps.entries())
              must(
                rules.replay(first.actions, ply + 1) === step.position,
                `replay to ply ${ply + 1} reached another position`
              );
          })
        )
    ),
    law(
      game,
      'the moves shown are the accepted actions, labelled as they were played',
      () =>
        assertProperty(
          `${game.label}: moves`,
          fc.property(picks, (drawn) => {
            const played = walk(rules, drawn);
            const moves = rules.moves(
              played.position,
              played.history,
              played.actions
            );
            must(
              same(
                moves.map((move) => [move.label, move.after]),
                played.steps.map((step) => [step.label, step.position])
              ),
              'the moves shown differ from the moves played'
            );
          })
        )
    ),
    law(
      game,
      'only a legal action is accepted, and a finished game accepts none',
      () =>
        assertProperty(
          `${game.label}: authority`,
          fc.property(
            picks,
            fc.array(strangers, { maxLength: 8 }),
            (drawn, sent) => {
              const played = walk(rules, drawn);
              const legal = rules.legal(played.position);
              // A game may end by its history (a repetition) while its
              // position still lists actions: finished, it accepts none.
              const finished = played.steps.at(-1)?.winner != null;
              // A near miss of a placement may be another placement the hand
              // allows, so a game with dealt hands is held to strangers alone.
              const near =
                game.shared.turnGame.rules.hands === undefined
                  ? misspellings(legal)
                  : [];
              for (const action of [
                ...sent,
                ...near,
                ...(finished ? legal : []),
              ])
                must(
                  (rules.play(
                    played.position,
                    action,
                    played.history,
                    played.actions
                  ) !==
                    null) ===
                    (!finished && legal.includes(action)),
                  `${action} was ${finished ? 'accepted after the game finished' : 'accepted against its legality'} at ${played.position}`
                );
            }
          )
        )
    ),
    ...duelRulesLaws(game),
    ...privateSetupLaws(game),
    ...dealtHandsLaws(game),
    law(game, 'its rules draw it only where the game names a line to it', () =>
      drawnOnlyWhereKnown(game)
    ),
    law(
      game,
      'the automated participant only ever chooses a legal action',
      () =>
        assertProperty(
          `${game.label}: automation`,
          fc.property(picks, draw, (drawn, r) => {
            const { position, steps } = walk(rules, drawn);
            // The platform never asks for a move in a finished game.
            if (steps.at(-1)?.winner != null) return;
            const legal = rules.legal(position);
            const own = seat(game, position);
            const chosen = game.shared.automation.turns.choose(
              own.position,
              () => r,
              own.hand
            );
            must(
              legal.length === 0
                ? chosen === null
                : chosen !== null &&
                    offered(
                      game,
                      { rules, position },
                      chosen,
                      () =>
                        rules.play(
                          position,
                          chosen,
                          '',
                          walk(rules, drawn).actions
                        ) !== null
                    ),
              `the automated participant chose ${String(chosen)} at ${position}`
            );
          })
        )
    ),
  ];
}

/** The laws of a game's bots, for a game offering custom games. */
export function gameBotLaws(
  game: TurnHarnessGame,
  params?: AssertPropertyParams
): readonly GameLaw[] {
  const rules = playedRulesOf(game);
  const customGames = game.shared.turnGame.capabilities['custom-games'];
  if (customGames === undefined) return [];
  const { bots } = customGames;
  const choose = bots.choose;
  if (choose === undefined)
    throw new Error('turn-game bot laws require turn choices');
  const strengths: readonly BotDifficulty[] =
    bots.difficulties.length === 0
      ? [DEFAULT_BOT_DIFFICULTY]
      : bots.difficulties;
  return [
    law(game, 'each strength is offered once', () =>
      must(
        new Set(bots.difficulties).size === bots.difficulties.length,
        'a strength is offered twice'
      )
    ),
    law(
      game,
      'bots in every declared seat play only legal actions until the game finishes',
      () =>
        assertProperty(
          `${game.label}: bots`,
          fc.property(
            fc.array(fc.constantFrom(...strengths), {
              minLength: gameSides(rules).length,
              maxLength: gameSides(rules).length,
            }),
            fc.array(draw, { minLength: 1, maxLength: 8 }),
            (difficulties, draws) => {
              let position = rules.initial();
              let history = '';
              const actions: string[] = [];
              for (let ply = 0; ply < BOT_PLIES; ply++) {
                const legal = rules.legal(position);
                const chosen = seatsProposal(game, position, (at, hand) =>
                  choose(
                    at,
                    difficulties[ply % difficulties.length]!,
                    () => draws[ply % draws.length]!,
                    hand
                  )
                );
                if (legal.length === 0) {
                  must(chosen === null, 'a bot moved in a finished game');
                  return;
                }
                const played =
                  chosen === null
                    ? null
                    : rules.play(position, chosen, history, actions);
                must(
                  chosen !== null &&
                    (committingAt(game, position) ||
                      offered(
                        game,
                        { rules, position },
                        chosen,
                        () => played !== null
                      )),
                  `a bot chose ${String(chosen)} at ${position}`
                );
                must(
                  played !== null,
                  `the bot's ${String(chosen)} was refused`
                );
                actions.push(chosen!);
                position = played!.position;
                history = played!.history;
                // The platform never asks a bot to move in a finished game.
                if (played!.winner !== null) return;
              }
            }
          ),
          params
        )
    ),
  ];
}
