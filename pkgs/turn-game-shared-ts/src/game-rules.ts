import type { PuzzlesCapability } from './game-puzzles';

/** Stable opaque seat tokens retained for durable records; visual identity comes from presentation. */
export const GAME_SIDES = ['white', 'black', 'red', 'blue'] as const;
export type GameSide = (typeof GAME_SIDES)[number];
export const TWO_PLAYER_SIDES = ['white', 'black'] as const;
export type TwoPlayerSide = (typeof TWO_PLAYER_SIDES)[number];

/** Narrow at the boundary of a board or rule set that only accepts two seats. */
export function requireTwoPlayerSide(side: GameSide): TwoPlayerSide {
  if (side !== 'white' && side !== 'black')
    throw new Error(`The two-seat game does not include ${side}`);
  return side;
}
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type PlayedPosition = {
  readonly position: string;
  readonly history: string;
  readonly turn: GameSide;
  readonly label: string;
  readonly winner: GameSide | 'draw' | null;
  readonly reason: string | null;
};
export type RecordedMove = {
  readonly label: string;
  readonly before: string;
  readonly after: string;
};
/** Game-independent data passed to each game's export codec. */
export type GameRecordMetadata = {
  readonly participants: readonly {
    readonly name: string;
    readonly rating: string | null;
  }[];
  readonly outcome: GameSide | 'draw';
  readonly reason: string | null;
  readonly timeControl: {
    readonly minutes: number;
    readonly incrementSeconds: number;
    readonly daysPerMove: number;
  } | null;
};
/** Both sides' private setups, as only the authority holds them together. */
export type GameSetups = Readonly<
  Record<'white' | 'black', string> & Partial<Record<'red' | 'blue', string>>
>;
/**
 * Private setups: before the first action each side prepares a setup only
 * that side and the authority may know (a hidden fleet). Every position
 * stays public. The authority resolves each proposed action with both
 * setups into the public action it records, so `play`, `replay` and
 * `moves` take public actions and never see a setup, while `legal`, bots
 * and automation propose from the public position alone.
 */
export type PrivateSetupRules = {
  /** The setup as the game stores it, or `null` unless it is one complete legal setup. */
  readonly accept: (setup: string) => string | null;
  /** A complete legal setup drawn with `random`. */
  readonly random: (random: () => number) => string;
  /**
   * The public action `proposal` by the side to move resolves to, or `null`
   * when it is refused. Called only by the authority.
   */
  readonly resolve: (
    position: string,
    proposal: string,
    setups: GameSetups
  ) => string | null;
};
/** The authority's decision on a proposal in a game with dealt hands. */
export type HandsResolution =
  | {
      /** The public action the proposal is recorded as. */
      readonly action: string;
      /** The hidden state after it. */
      readonly hidden: string;
    }
  | {
      /** Why the proposal is refused; nothing changes. */
      readonly refusal: string;
    };
/**
 * Dealt hands: hidden information the authority deals when a game starts
 * and keeps as play goes on (a shuffled bag, each side's rack of tiles).
 * Every position stays public. The authority alone holds the hidden state;
 * each side sees only its own hand (`hand`), which may change after every
 * action, and the authority resolves each proposal with the hidden state
 * into the public action it records, so `play`, `replay` and `moves` take
 * public actions and never see a hand. Bots and automation choose from the
 * public position and their own side's hand alone.
 */
export type DealtHandsRules = {
  /** A new game's hidden state at `position`, dealt with the authority's `random`. */
  readonly deal: (position: string, random: () => number) => string;
  /** Everything `side` may know of `hidden`: its own hand, never another side's. */
  readonly hand: (hidden: string, side: GameSide) => string;
  /**
   * The authority's decision on `proposal` by the side to move: the public
   * action and next hidden state, or a refusal. Called only by the
   * authority; a refusal leaves the hidden state as it was.
   */
  readonly resolve: (
    position: string,
    proposal: string,
    hidden: string
  ) => HandsResolution;
  /**
   * Some proposals `hand` allows at `position`, as its side could make
   * them (bounded; the shared laws and drivers walk games with them).
   */
  readonly proposals: (position: string, hand: string) => readonly string[];
};
/**
 * A turn game's mechanics: what every shared lifecycle needs to
 * hold, check and show a game. Positions and actions are opaque strings the
 * platform never parses; `recognizes` must accept only this game's
 * positions, so a position always names exactly one game.
 */
export type GameRules = {
  /** Package ownership shared by modes of one game; omitted when it is this rule set's id. */
  readonly family?: string;
  /** Ordered seats; omitted by games using the standard two seats. */
  readonly sides?: readonly GameSide[];
  /**
   * Present for a game whose sides prepare private setups before play; its
   * `legal` actions are proposals and the rest take resolved public actions.
   */
  readonly setup?: PrivateSetupRules;
  /**
   * Present for a game whose authority deals hidden hands as it starts; its
   * `legal` lists the proposals every hand allows (passing) and the rest
   * take resolved public actions.
   */
  readonly hands?: DealtHandsRules;
  /**
   * Loads the immutable data the rules decide with (a word list), once.
   * The platform awaits it before an authority, a bot or a device playing
   * alone decides; a decision needing data that has not loaded throws, so it
   * fails without effect and can be retried.
   */
  readonly prepare?: () => Promise<void>;
  readonly id: string;
  readonly recognizes: (position: string) => boolean;
  readonly initial: () => string;
  /** The position after `action`, or `null` when the action is refused. */
  readonly play: (
    position: string,
    action: string,
    history: string,
    actions: readonly string[]
  ) => PlayedPosition | null;
  /** The position after the first `ply` accepted `actions` from the start. */
  readonly replay: (actions: readonly string[], ply: number) => string;
  /**
   * The actions `position` allows. A game may also end by its history (a
   * repetition) while its position still lists actions; `play`, which sees
   * the history, then refuses them, and the result of the move that ended
   * the game said so.
   */
  readonly legal: (position: string) => readonly string[];
  /** Whether `side` could still win (a flag fall against it is otherwise a draw). */
  readonly canWin: (position: string, side: GameSide) => boolean;
  /** Each accepted action of the game so far, labelled as the game names it. */
  readonly moves: (
    position: string,
    history: string,
    actions: readonly string[]
  ) => readonly RecordedMove[];
};
/** Modes may share game packages while retaining distinct ids and conformance evidence. */
export function gameFamily(rules: Pick<GameRules, 'id' | 'family'>): string {
  const family = rules.family ?? rules.id;
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(family))
    throw new Error(`${rules.id}: game family must be a lowercase slug`);
  return family;
}

/** The ordered seats a game requires, including its compatibility default. */
export function gameSides(
  rules: Pick<GameRules, 'sides'>
): readonly GameSide[] {
  return rules.sides ?? TWO_PLAYER_SIDES;
}

/**
 * Validate a roster before its rules enter any shared lifecycle: two to four
 * seats, in the platform's seat order (`white`, `black`, then `red`, `blue`).
 */
export function assertGameSides(rules: Pick<GameRules, 'id' | 'sides'>): void {
  const sides = gameSides(rules);
  if (
    sides.length < 2 ||
    sides.length > 4 ||
    sides.some((side, index) => GAME_SIDES[index] !== side)
  )
    throw new Error(
      `${rules.id}: declare two to four ordered seats, in the order white, black, red, blue`
    );
}

export type GameNoticeText = {
  readonly timeoutDraw: (flagged: GameSide) => string;
  readonly side: (side: GameSide) => string;
  readonly ending: (reason: string) => string | undefined;
};
/** A bot for each side of a custom game; it only ever chooses among `legal`. */
export type GameBots = {
  /** Strengths people choose between; empty when the game has one bot. */
  readonly difficulties: readonly BotDifficulty[];
  readonly choose: (
    position: string,
    difficulty: BotDifficulty,
    random: () => number,
    /** The bot side's own hand, for a game with dealt hands; `null` otherwise. */
    hand: string | null
  ) => string | null;
};
/**
 * Custom games in a space: sides, people and bots, invitations, clocks,
 * resignation, draws, rematches and offline solo play.
 */
export type CustomGamesCapability = { readonly bots: GameBots };
/**
 * Finding an opponent at a clock choice: matched games, ratings per speed,
 * turn and result notices, rematches and the multiplayer link.
 */
export type MatchmakingCapability = {
  /** Namespace of the game's clock choices, searches and ratings (`<id>/`). */
  readonly clockNamespace: string;
  /** Notice copy the server sends without the client's translations. */
  readonly notice: GameNoticeText;
};
/** History, statistics and review of finished games, and their export. */
export type HistoryCapability = {
  /** The game's portable record of a finished game (the downloaded file). */
  readonly record: (
    position: string,
    history: string,
    metadata: GameRecordMetadata
  ) => string;
};
/**
 * What the shared platform offers for a turn game, each with what it needs
 * from the game. A capability is offered exactly when it is present: the
 * platform shows, accepts and tests nothing for an absent one, and a game
 * never supplies a placeholder for what it does not offer. Finding an
 * opponent needs history: every finished matched game offers its game
 * record, which only `history.record` writes.
 */
export type TurnGameCapabilities = {
  readonly 'custom-games'?: CustomGamesCapability;
  /** Puzzles from the game's positions; needs no other capability. */
  readonly puzzles?: PuzzlesCapability;
} & (
  | {
      readonly matchmaking: MatchmakingCapability;
      readonly history: HistoryCapability;
    }
  | {
      readonly matchmaking?: never;
      readonly history?: HistoryCapability;
    }
);
export type GameCapability = keyof TurnGameCapabilities;
export const GAME_CAPABILITIES = [
  'custom-games',
  'matchmaking',
  'history',
  'puzzles',
] as const satisfies readonly GameCapability[];
/**
 * What each capability needs offered beside it: matched games offer a game
 * record, so finding an opponent needs history.
 */
export const CAPABILITY_REQUIRES: Readonly<
  Partial<Record<GameCapability, readonly GameCapability[]>>
> = { matchmaking: ['history'] };
export type RegisteredTurnGame = {
  readonly rules: GameRules;
  readonly capabilities: TurnGameCapabilities;
  /**
   * The one game whose stored clock choices, searches, ratings and puzzles
   * predate namespaces keeps the unprefixed namespace `''`; every other
   * game's is `'<id>/'`. Only the composition granting it may set this.
   */
  readonly unprefixedNamespace?: true;
};
/** The capabilities `game` offers, in the platform's order. */
export function offeredCapabilities(
  game: RegisteredTurnGame
): readonly GameCapability[] {
  return GAME_CAPABILITIES.filter(
    (capability) => game.capabilities[capability] !== undefined
  );
}
export type TurnGames = {
  readonly games: readonly RegisteredTurnGame[];
  readonly forPosition: (position: string) => GameRules;
  readonly byId: (id: string) => GameRules;
  /** The matchmaking game whose clock namespace `control` is in. */
  readonly forControl: (control: string) => GameRules;
  /** Whether the registered game `id` offers `capability`. */
  readonly offers: (id: string, capability: GameCapability) => boolean;
  /** What the registered game `id` supplies for `capability`, if it offers it. */
  readonly capability: <C extends GameCapability>(
    id: string,
    capability: C
  ) => TurnGameCapabilities[C] | undefined;
};
/**
 * The public action an accepted proposal is recorded as: for a game with
 * private setups, resolved with both of them (`null` when refused); for any
 * other game, the proposal itself.
 */
export function publicAction(
  rules: GameRules,
  position: string,
  proposal: string,
  setups: GameSetups | null
): string | null {
  if (rules.setup === undefined) return proposal;
  if (setups === null)
    throw new Error(
      `${rules.id}: only the authority holding both setups resolves an action`
    );
  return rules.setup.resolve(position, proposal, setups);
}

/** Fail when a game offers a capability without what it needs beside it. */
function assertRequirements(game: RegisteredTurnGame): void {
  if (
    gameSides(game.rules).length > 2 &&
    (game.rules.setup !== undefined || game.capabilities.puzzles !== undefined)
  )
    throw new Error(
      `${game.rules.id}: private setups and puzzles require two declared seats`
    );
  if (game.rules.hands !== undefined && game.rules.setup !== undefined)
    throw new Error(
      `${game.rules.id}: a game deals hands or has private setups, not both`
    );
  if (game.rules.hands !== undefined && game.capabilities.puzzles !== undefined)
    throw new Error(
      `${game.rules.id}: a rated puzzle shows its whole position to the solver, so a game with dealt hands offers no puzzle feed — offer authored puzzle content instead`
    );
  if (game.rules.setup !== undefined && game.capabilities.puzzles !== undefined)
    throw new Error(
      `${game.rules.id}: a puzzle shows its whole position to the solver, so a game with private setups offers no puzzles — remove capabilities.puzzles`
    );
  for (const [capability, needs] of Object.entries(CAPABILITY_REQUIRES))
    for (const need of needs ?? [])
      if (
        game.capabilities[capability as GameCapability] !== undefined &&
        game.capabilities[need] === undefined
      )
        throw new Error(
          `${game.rules.id}: offering ${capability} needs ${need} too (every finished matched game offers its game record) — add capabilities.${need}`
        );
}

/** The namespaces a game's capabilities claim, by what each names. */
const NAMESPACES = [
  {
    of: 'clock',
    read: (game: RegisteredTurnGame) =>
      game.capabilities.matchmaking?.clockNamespace,
  },
  {
    of: 'puzzle',
    read: (game: RegisteredTurnGame) => game.capabilities.puzzles?.namespace,
  },
] as const;

/** The `kind` namespace `game` may use. */
function assertNamespace(
  game: RegisteredTurnGame,
  kind: string,
  namespace: string
) {
  const id = game.rules.id;
  if (namespace === '' && game.unprefixedNamespace !== true)
    throw new Error(
      `${id}: the unprefixed ${kind} namespace "" belongs to the platform's durable game alone — use "${id}/"`
    );
  if (namespace !== '' && namespace !== `${id}/`)
    throw new Error(`${id}: ${kind} namespace "${namespace}" is not "${id}/"`);
}

/** Fail when the registered games cannot be told apart by id, position or namespace. */
function assertDistinct(games: readonly RegisteredTurnGame[]): void {
  if (new Set(games.map((g) => g.rules.id)).size !== games.length)
    throw new Error('Duplicate game rules');
  for (const game of games) {
    gameFamily(game.rules);
    assertGameSides(game.rules);
    assertRequirements(game);
  }
  for (const { of, read } of NAMESPACES) {
    const namespaces = new Set<string>();
    for (const game of games) {
      const namespace = read(game);
      if (namespace === undefined) continue;
      assertNamespace(game, of, namespace);
      if (namespaces.has(namespace))
        throw new Error(
          `${game.rules.id}: ${of} namespace "${namespace}" is taken`
        );
      namespaces.add(namespace);
    }
  }
  for (const game of games) {
    const initial = game.rules.initial();
    const claimed = games.filter((other) => other.rules.recognizes(initial));
    if (claimed.length !== 1 || claimed[0] !== game)
      throw new Error(
        `${game.rules.id}: its starting position must be recognized by it alone`
      );
  }
}
export function createTurnGames(
  games: readonly RegisteredTurnGame[]
): TurnGames {
  assertDistinct(games);
  const one = (matches: readonly GameRules[]): GameRules => {
    if (matches.length !== 1)
      throw new Error('Unknown or ambiguous game rules');
    return matches[0]!;
  };
  const registered = (id: string) => games.find((game) => game.rules.id === id);
  return {
    games,
    offers: (id, capability) =>
      registered(id)?.capabilities[capability] !== undefined,
    capability: (id, capability) => registered(id)?.capabilities[capability],
    byId: (id) =>
      one(games.filter((g) => g.rules.id === id).map((g) => g.rules)),
    forPosition: (position) =>
      one(
        games.filter((g) => g.rules.recognizes(position)).map((g) => g.rules)
      ),
    forControl: (control) => {
      const namespace = control.includes('/')
        ? `${control.split('/')[0]}/`
        : '';
      return one(
        games
          .filter(
            (g) => g.capabilities.matchmaking?.clockNamespace === namespace
          )
          .map((g) => g.rules)
      );
    },
  };
}
/**
 * Load every registered game's rule data (`GameRules.prepare`), once: what
 * a composition root awaits before an authority, a bot or a device playing
 * alone decides.
 */
export async function prepareTurnGames(turnGames: TurnGames): Promise<void> {
  await Promise.all(turnGames.games.map((game) => game.rules.prepare?.()));
}

export function requireTurnGames(env: {
  readonly turnGames?: TurnGames;
}): TurnGames {
  if (env.turnGames === undefined)
    throw new Error('The composition root must inject turn-game rules');
  return env.turnGames;
}
