import type {
  DealtHandsRules,
  GameRules,
  GameSetups,
  GameSide,
  PrivateSetupRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';

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

/**
 * A known deal of a game with dealt hands: the numbers the authority's
 * random source returns while it deals a new game (`draws`), the hidden
 * state that deal is (`hidden`), and optionally the hand each side holds
 * before each move of the known victory, written by hand as an
 * independent check of the dealing and drawing.
 */
export type KnownDeal = {
  readonly draws: readonly number[];
  readonly hidden: string;
  readonly hands?: readonly Readonly<Partial<Record<GameSide, string>>>[];
};

/** What a game's conformance adapter says of its rules, known setups and known deal. */
type KnownGame = {
  readonly label: string;
  readonly shared: { readonly turnGame: { readonly rules: GameRules } };
  readonly fixtures: {
    readonly setups?: GameSetups;
    readonly knownDeal?: KnownDeal;
  };
};

/** A number source returning `draws` in turn, then repeating the last. */
export function scriptedRandom(draws: readonly number[]): () => number {
  let next = 0;
  return () => draws[Math.min(next++, draws.length - 1)] ?? 0;
}

/** `game`'s rules as its authority plays them with its known setups or deal. */
export function playedRulesOf(game: KnownGame): GameRules {
  const rules = game.shared.turnGame.rules;
  if (rules.hands !== undefined) {
    const deal = game.fixtures.knownDeal;
    if (deal === undefined)
      throw new Error(
        `${game.label}: a game with dealt hands names a known deal (fixtures.knownDeal)`
      );
    return dealtRules(rules, rules.hands, deal.hidden);
  }
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
 * readied with the known setups, or whose authority dealt the known deal
 * and has been given `before` (the proposals so far): resolved for such a
 * game, the proposal itself for any other game.
 */
export function recordedMove(
  game: KnownGame,
  position: string,
  proposal: string,
  before: readonly string[] = []
): string {
  const rules = game.shared.turnGame.rules;
  if (rules.hands !== undefined)
    return recordedLine(game, [...before, proposal]).at(-1)!;
  const setups = game.fixtures.setups;
  if (rules.setup === undefined || setups === undefined) return proposal;
  const action = rules.setup.resolve(position, proposal, setups);
  if (action === null)
    throw new Error(`${game.label}: ${proposal} is not a move at ${position}`);
  return action;
}

/**
 * How a known line of proposals (`firstSideVictory`, a refused or drawn
 * line) is recorded in a game whose people readied with the known setups,
 * or whose authority dealt the known deal: each proposal resolved from the
 * position the line had reached, or the line itself for any other game.
 */
export function recordedLine(
  game: KnownGame,
  proposals: readonly string[]
): string[] {
  const rules = game.shared.turnGame.rules;
  if (rules.setup === undefined && rules.hands === undefined)
    return [...proposals];
  if (rules.hands !== undefined) {
    const played = playedRulesOf(game);
    const resolved = handsLine(rules, rules.hands, {
      hidden: game.fixtures.knownDeal!.hidden,
      proposals,
    });
    if (resolved.actions.length !== proposals.length)
      throw new Error(
        `${game.label}: ${proposals[resolved.actions.length]} is not a move of ${played.id}`
      );
    return [...resolved.actions];
  }
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

/**
 * A phase of private commitments, as one proposal of a known line: every
 * committing side's commitment, in seat order, after `commit:` and joined by
 * `|`. The authority resolves the whole phase at once, so one proposal is
 * still one public action, as the shared laws read every line.
 */
const COMMITMENTS = 'commit:';

export function committedProposal(commitments: readonly string[]): string {
  return `${COMMITMENTS}${commitments.join('|')}`;
}

/** Each committing side's commitment of a combined proposal, or `null` for any other proposal. */
export function splitCommittedProposal(
  proposal: string
): readonly string[] | null {
  return proposal.startsWith(COMMITMENTS)
    ? proposal.slice(COMMITMENTS.length).split('|')
    : null;
}

/** The sides that commit at `position`, empty while play is by turns. */
function committingSides(
  hands: DealtHandsRules,
  position: string
): readonly GameSide[] {
  return hands.commit?.sides(position) ?? [];
}

/**
 * What the authority records for `proposal` at `position`: a move resolved
 * with the hidden state, or, while every side commits, the commitments of
 * a combined proposal resolved together. `null` when refused.
 */
function resolveDealt(
  hands: DealtHandsRules,
  position: string,
  proposal: string,
  hidden: string
): { readonly action: string; readonly hidden: string } | null {
  const sides = committingSides(hands, position);
  if (sides.length === 0 || hands.commit === undefined) {
    const resolution = hands.resolve(position, proposal, hidden);
    return 'refusal' in resolution ? null : resolution;
  }
  if (!proposal.startsWith(COMMITMENTS)) return null;
  const parts = proposal.slice(COMMITMENTS.length).split('|');
  if (parts.length !== sides.length) return null;
  const commitments: Partial<Record<GameSide, string>> = {};
  for (const [index, side] of sides.entries()) {
    const accepted = hands.commit.accept(
      position,
      side,
      hands.hand(hidden, side),
      parts[index]!
    );
    if ('refusal' in accepted) return null;
    commitments[side] = accepted.commitment;
  }
  return hands.commit.resolve(position, commitments, hidden);
}

/**
 * What may be proposed at `position`: the mover's bounded proposals, or,
 * while every side commits, a few combined proposals made of each side's
 * own (the i-th of every side's together).
 */
function dealtLegal(
  hands: DealtHandsRules,
  at: {
    readonly position: string;
    readonly hidden: string;
    readonly turn: GameSide;
  }
): readonly string[] {
  const sides = committingSides(hands, at.position);
  if (sides.length === 0)
    return hands.proposals(at.position, hands.hand(at.hidden, at.turn));
  const options = sides.map((side) =>
    hands.proposals(at.position, hands.hand(at.hidden, side))
  );
  if (options.some((own) => own.length === 0)) return [];
  const count = Math.max(...options.map((own) => own.length));
  return Array.from({ length: count }, (_, i) =>
    committedProposal(options.map((own) => own[i % own.length]!))
  );
}

/** Positions of a dealt-hands view: the public position, the hidden state, the side to move. */
const SEPARATOR = '\n';

export function dealtPosition(
  position: string,
  hidden: string,
  turn: GameSide
): string {
  return [position, hidden, turn].join(SEPARATOR);
}

/** The public position, hidden state and side to move of a dealt-hands view position. */
export function splitDealtPosition(composite: string): {
  readonly position: string;
  readonly hidden: string;
  readonly turn: GameSide;
} {
  const [position = '', hidden = '', turn = 'white'] =
    composite.split(SEPARATOR);
  return { position, hidden, turn: turn as GameSide };
}

/**
 * The public position a played-rules position is, as the product stores
 * and shows it: itself for most games, the public part for dealt hands.
 */
export function publicPosition(position: string): string {
  return splitDealtPosition(position).position;
}

type HandsLine = {
  readonly actions: readonly string[];
  readonly position: string;
  readonly hidden: string;
  readonly turn: GameSide;
  readonly history: string;
};

/** The public actions the proposals resolve to, from the known deal, stopping at a refusal. */
function handsLine(
  rules: GameRules,
  hands: DealtHandsRules,
  line: {
    readonly hidden: string;
    readonly proposals: readonly string[];
    /** A line already resolved for a prefix of `proposals`, to continue from. */
    readonly from?: {
      readonly proposals: readonly string[];
      readonly state: HandsLine;
    };
  }
): HandsLine {
  const from = line.from;
  const continues =
    from !== undefined &&
    from.state.actions.length === from.proposals.length &&
    from.proposals.length <= line.proposals.length &&
    from.proposals.every((proposal, i) => proposal === line.proposals[i]);
  let state: HandsLine = continues
    ? from.state
    : {
        actions: [],
        position: rules.initial(),
        hidden: line.hidden,
        turn: gameSides(rules)[0]!,
        history: '',
      };
  for (const proposal of line.proposals.slice(state.actions.length)) {
    const resolution = resolveDealt(
      hands,
      state.position,
      proposal,
      state.hidden
    );
    if (resolution === null) break;
    const played = rules.play(
      state.position,
      resolution.action,
      state.history,
      state.actions
    );
    if (played === null) break;
    state = {
      actions: [...state.actions, resolution.action],
      position: played.position,
      hidden: resolution.hidden,
      turn: played.turn,
      history: played.history,
    };
  }
  return state;
}

/**
 * A game with dealt hands as its authority plays it from a known deal, on
 * proposals. Its positions carry the hidden state and the side to move
 * beside the public position (`dealtPosition`), so every shared law can walk
 * it: `legal` is the bounded proposals the mover's hand allows, `play`
 * resolves a proposal with the hidden state, and `replay` and `moves`
 * re-resolve the proposals from the deal.
 */
function dealtRules(
  rules: GameRules,
  hands: DealtHandsRules,
  hidden: string
): GameRules {
  // Shared walks extend one line a proposal at a time: continue from the
  // last line resolved rather than replaying from the deal each time.
  let last: { proposals: readonly string[]; state: HandsLine } | undefined;
  const line = (proposals: readonly string[], ply = proposals.length) => {
    const wanted = proposals.slice(0, ply);
    const state = handsLine(rules, hands, {
      hidden,
      proposals: wanted,
      ...(last === undefined ? {} : { from: last }),
    });
    last = { proposals: wanted, state };
    return state;
  };
  const composite = (state: HandsLine) =>
    dealtPosition(state.position, state.hidden, state.turn);
  return {
    id: rules.id,
    ...(rules.sides === undefined ? {} : { sides: rules.sides }),
    recognizes: (position) =>
      rules.recognizes(splitDealtPosition(position).position),
    initial: () => composite(line([])),
    legal: (position) => {
      const at = splitDealtPosition(position);
      if (
        rules.legal(at.position).length === 0 &&
        committingSides(hands, at.position).length === 0
      )
        return [];
      return dealtLegal(hands, at);
    },
    canWin: (position, side) =>
      rules.canWin(splitDealtPosition(position).position, side),
    play: (position, proposal, history, proposals) => {
      const at = splitDealtPosition(position);
      const before = line(proposals);
      const resolution = resolveDealt(hands, at.position, proposal, at.hidden);
      if (resolution === null) return null;
      const played = rules.play(
        at.position,
        resolution.action,
        history,
        before.actions
      );
      return played === null
        ? null
        : {
            ...played,
            position: dealtPosition(
              played.position,
              resolution.hidden,
              played.turn
            ),
          };
    },
    replay: (proposals, ply) => composite(line(proposals, ply)),
    moves: (_position, _history, proposals) =>
      proposals.flatMap((_, ply) => {
        const before = line(proposals, ply);
        const after = line(proposals, ply + 1);
        if (after.actions.length !== ply + 1) return [];
        const label =
          rules.moves(after.position, after.history, after.actions).at(-1)
            ?.label ?? '';
        return [{ label, before: composite(before), after: composite(after) }];
      }),
  };
}
