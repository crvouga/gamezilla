import type { PuzzlesCapability } from './game-puzzles';

/** Stable opaque seat tokens retained for durable records; visual identity comes from presentation. */
export type GameSide = 'white' | 'black';
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
  readonly participants: readonly [
    { readonly name: string; readonly rating: string | null },
    { readonly name: string; readonly rating: string | null },
  ];
  readonly outcome: GameSide | 'draw';
  readonly reason: string | null;
  readonly timeControl: {
    readonly minutes: number;
    readonly incrementSeconds: number;
    readonly daysPerMove: number;
  } | null;
};
/**
 * A two-sided turn game's mechanics: what every shared lifecycle needs to
 * hold, check and show a game. Positions and actions are opaque strings the
 * platform never parses; `recognizes` must accept only this game's
 * positions, so a position always names exactly one game.
 */
export type GameRules = {
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
    random: () => number
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
/** Fail when a game offers a capability without what it needs beside it. */
function assertRequirements(game: RegisteredTurnGame): void {
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
  for (const game of games) assertRequirements(game);
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
export function requireTurnGames(env: {
  readonly turnGames?: TurnGames;
}): TurnGames {
  if (env.turnGames === undefined)
    throw new Error('The composition root must inject turn-game rules');
  return env.turnGames;
}
