import type {
  GameRules,
  GameSetups,
  PrivateSetupRules,
} from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * A game's rules as its authority plays them, on proposals. For a game
 * with private setups, the authority holds `setups` and resolves each
 * proposal into the public action the rules play; for any other game, the
 * rules themselves. The shared laws hold every game to the same contract
 * through this one view: a known line, a refused opening, a drawn walk and a
 * bot's choice are all proposals, as people and bots make them.
 */
export function playedRules(rules: GameRules, setups: GameSetups): GameRules;
export function playedRules(rules: GameRules): GameRules;
export function playedRules(rules: GameRules, setups?: GameSetups): GameRules {
  const setup = rules.setup;
  if (setup === undefined) return rules;
  if (setups === undefined)
    throw new Error(
      `${rules.id}: playing a game with private setups needs both setups`
    );
  return resolving(rules, setup, setups);
}

function resolving(
  rules: GameRules,
  setup: PrivateSetupRules,
  setups: GameSetups
): GameRules {
  /** The public actions the first `ply` proposals of a line resolve to. */
  const resolved = (proposals: readonly string[], ply: number): string[] => {
    let position = rules.initial();
    const actions: string[] = [];
    for (const proposal of proposals.slice(0, ply)) {
      const action = setup.resolve(position, proposal, setups);
      const played =
        action === null ? null : rules.play(position, action, '', actions);
      if (action === null || played === null) break;
      actions.push(action);
      position = played.position;
    }
    return actions;
  };
  return {
    id: rules.id,
    recognizes: rules.recognizes,
    initial: rules.initial,
    legal: rules.legal,
    canWin: rules.canWin,
    play: (position, proposal, history, actions) => {
      const action = setup.resolve(position, proposal, setups);
      return action === null
        ? null
        : rules.play(
            position,
            action,
            history,
            resolved(actions, actions.length)
          );
    },
    replay: (proposals, ply) => rules.replay(resolved(proposals, ply), ply),
    moves: (position, history, proposals) =>
      rules.moves(position, history, resolved(proposals, proposals.length)),
  };
}

/** What a game's conformance adapter says of its rules and known setups. */
type KnownGame = {
  readonly label: string;
  readonly shared: { readonly turnGame: { readonly rules: GameRules } };
  readonly fixtures: { readonly setups?: GameSetups };
};

/** `game`'s rules as its authority plays them with its known setups. */
export function playedRulesOf(game: KnownGame): GameRules {
  const rules = game.shared.turnGame.rules;
  if (rules.setup === undefined) return rules;
  const setups = game.fixtures.setups;
  if (setups === undefined)
    throw new Error(
      `${game.label}: a game with private setups names two known setups (fixtures.setups)`
    );
  return playedRules(rules, setups);
}

/**
 * How a proposal made at `position` is recorded in a game whose people
 * readied with the known setups: resolved for a game with private setups,
 * the proposal itself for any other game.
 */
export function recordedMove(
  game: KnownGame,
  position: string,
  proposal: string
): string {
  const rules = game.shared.turnGame.rules;
  const setups = game.fixtures.setups;
  if (rules.setup === undefined || setups === undefined) return proposal;
  const action = rules.setup.resolve(position, proposal, setups);
  if (action === null)
    throw new Error(`${game.label}: ${proposal} is not a move at ${position}`);
  return action;
}

/**
 * How a known line of proposals (`firstSideVictory`, a refused or drawn
 * line) is recorded in a game whose people readied with the known setups:
 * each proposal resolved from the position the line had reached, or the
 * line itself for any other game.
 */
export function recordedLine(
  game: KnownGame,
  proposals: readonly string[]
): string[] {
  const rules = game.shared.turnGame.rules;
  if (rules.setup === undefined) return [...proposals];
  let position = rules.initial();
  let history = '';
  const actions: string[] = [];
  for (const proposal of proposals) {
    const action = recordedMove(game, position, proposal);
    const played = rules.play(position, action, history, actions);
    if (played === null)
      throw new Error(
        `${game.label}: ${proposal} is not a move at ${position}`
      );
    actions.push(action);
    position = played.position;
    history = played.history;
  }
  return actions;
}
