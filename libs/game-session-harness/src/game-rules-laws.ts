import { DEFAULT_BOT_DIFFICULTY } from '@libs/game-session-shared/custom-game-state';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import type {
  BotDifficulty,
  GameRules,
} from '@pkgs/turn-game-shared/game-rules';
import fc from 'fast-check';
import type { HarnessGame } from './harness-game';

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
  readonly label: string;
  readonly winner: string | null;
};

function law(game: HarnessGame, name: string, check: () => void): GameLaw {
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

function must(holds: boolean, problem: string): void {
  if (!holds) throw new Error(problem);
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The game from its start, taking the `picks`-th legal action each turn. */
function walk(rules: GameRules, picks: readonly number[]) {
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
    steps.push({ position, label: played!.label, winner: played!.winner });
    if (played!.winner !== null) break;
  }
  return { actions, steps, position, history };
}

const picks = fc.array(fc.nat(), { maxLength: WALK_PLIES });
const draw = fc.double({ min: 0, max: 1, maxExcluded: true });
/** Actions a person, a stale client or a hostile one might send. */
const strangers = fc.oneof(
  fc.string({ maxLength: 6 }),
  fc.stringMatching(/^[a-h][1-8][a-h][1-8][a-z]?$/),
  fc.stringMatching(/^-?[0-9]{1,2}$/)
);

/** The positions of a game's known line, from its start to its victory. */
function knownPositions(game: HarnessGame): readonly string[] {
  const rules = game.shared.turnGame.rules;
  const line = game.fixtures.firstSideVictory;
  return Array.from({ length: line.length + 1 }, (_, ply) =>
    rules.replay(line, ply)
  );
}

/** The fixtures' known line, which only its last move wins, and then nothing. */
function knownVictory(game: HarnessGame): void {
  const rules = game.shared.turnGame.rules;
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
  must(rules.legal(position).length === 0, 'a won game still offers actions');
  for (const action of [...victory, ...game.fixtures.refusedOpenings])
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
 * Every law of a turn game's rules, for `game`, among the `others` whose
 * positions it must never claim.
 */
export function gameRulesLaws(
  game: HarnessGame,
  others: readonly HarnessGame[]
): readonly GameLaw[] {
  const rules = game.shared.turnGame.rules;
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
          for (const position of knownPositions(other))
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
                  !other.shared.turnGame.rules.recognizes(position),
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
              if (played.steps.at(-1)?.winner != null)
                must(legal.length === 0, 'a finished game offers actions');
              for (const action of sent)
                must(
                  (rules.play(
                    played.position,
                    action,
                    played.history,
                    played.actions
                  ) !==
                    null) ===
                    legal.includes(action),
                  `${action} was accepted against its legality at ${played.position}`
                );
            }
          )
        )
    ),
    law(
      game,
      'the automated participant only ever chooses a legal action',
      () =>
        assertProperty(
          `${game.label}: automation`,
          fc.property(picks, draw, (drawn, r) => {
            const { position } = walk(rules, drawn);
            const legal = rules.legal(position);
            const chosen = game.shared.automation.choose(position, () => r);
            must(
              legal.length === 0
                ? chosen === null
                : legal.includes(chosen ?? ''),
              `the automated participant chose ${String(chosen)} at ${position}`
            );
          })
        )
    ),
  ];
}

/** The laws of a game's bots, for a game offering custom games. */
export function gameBotLaws(game: HarnessGame): readonly GameLaw[] {
  const rules = game.shared.turnGame.rules;
  const customGames = game.shared.turnGame.capabilities['custom-games'];
  if (customGames === undefined) return [];
  const { bots } = customGames;
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
    law(game, 'two bots play only legal actions until the game finishes', () =>
      assertProperty(
        `${game.label}: bots`,
        fc.property(
          fc.constantFrom(...strengths),
          fc.constantFrom(...strengths),
          fc.array(draw, { minLength: 1, maxLength: 8 }),
          (first, second, draws) => {
            let position = rules.initial();
            let history = '';
            const actions: string[] = [];
            for (let ply = 0; ply < BOT_PLIES; ply++) {
              const legal = rules.legal(position);
              const chosen = bots.choose(
                position,
                ply % 2 === 0 ? first : second,
                () => draws[ply % draws.length]!
              );
              if (legal.length === 0) {
                must(chosen === null, 'a bot moved in a finished game');
                return;
              }
              must(
                chosen !== null && legal.includes(chosen),
                `a bot chose ${String(chosen)} at ${position}`
              );
              const played = rules.play(position, chosen!, history, actions)!;
              actions.push(chosen!);
              position = played.position;
              history = played.history;
            }
          }
        )
      )
    ),
  ];
}
