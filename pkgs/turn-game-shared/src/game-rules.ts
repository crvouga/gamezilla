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
/** Rules and codecs supplied by a game. The host treats positions and actions as opaque. */
export type GameRules = {
  readonly botDifficulties: readonly BotDifficulty[];
  readonly id: string;
  readonly recognizes: (position: string) => boolean;
  readonly initial: () => string;
  readonly play: (
    position: string,
    action: string,
    history: string,
    actions: readonly string[]
  ) => PlayedPosition | null;
  readonly replay: (actions: readonly string[], ply: number) => string;
  readonly legal: (position: string) => readonly string[];
  readonly canWin: (position: string, side: GameSide) => boolean;
  readonly choose: (
    position: string,
    difficulty: BotDifficulty,
    random: () => number
  ) => string | null;
  readonly moves: (
    position: string,
    history: string,
    actions: readonly string[]
  ) => readonly RecordedMove[];
  readonly record: (
    position: string,
    history: string,
    metadata: GameRecordMetadata
  ) => string;
};
export type GameNoticeText = {
  readonly timeoutDraw: (flagged: GameSide) => string;
  readonly side: (side: GameSide) => string;
  readonly ending: (reason: string) => string | undefined;
};
/**
 * What the shared platform offers for a turn game. Each needs only the rules,
 * clock namespace and notice text every registration already supplies; a
 * capability a game does not declare is absent everywhere, never disabled.
 */
export const GAME_CAPABILITIES = [
  'custom-games',
  'matchmaking',
  'history',
] as const;
export type GameCapability = (typeof GAME_CAPABILITIES)[number];
export type RegisteredTurnGame = {
  readonly rules: GameRules;
  /** Clock namespace of the game's searches and ratings (`''` or `<id>/`). */
  readonly controlPrefix: string;
  readonly notice: GameNoticeText;
  readonly capabilities: readonly GameCapability[];
};
export type TurnGames = {
  readonly games: readonly RegisteredTurnGame[];
  readonly forPosition: (position: string) => GameRules;
  readonly notice: (id: string) => GameNoticeText | undefined;
  readonly byId: (id: string) => GameRules;
  readonly forControl: (control: string) => GameRules;
  /** Whether the registered game `id` declares `capability`. */
  readonly offers: (id: string, capability: GameCapability) => boolean;
};
export function createTurnGames(
  games: readonly RegisteredTurnGame[]
): TurnGames {
  if (new Set(games.map((g) => g.rules.id)).size !== games.length)
    throw new Error('Duplicate game rules');
  const one = (matches: readonly GameRules[]): GameRules => {
    if (matches.length !== 1)
      throw new Error('Unknown or ambiguous game rules');
    return matches[0]!;
  };
  return {
    games,
    offers: (id, capability) =>
      games.some(
        (game) => game.rules.id === id && game.capabilities.includes(capability)
      ),
    notice: (id) => games.find((game) => game.rules.id === id)?.notice,
    byId: (id) =>
      one(games.filter((g) => g.rules.id === id).map((g) => g.rules)),
    forPosition: (position) =>
      one(
        games.filter((g) => g.rules.recognizes(position)).map((g) => g.rules)
      ),
    forControl: (control) =>
      one(
        games
          .filter(
            (g) =>
              g.controlPrefix ===
              (control.includes('/') ? `${control.split('/')[0]}/` : '')
          )
          .map((g) => g.rules)
      ),
  };
}
export function requireTurnGames(env: {
  readonly turnGames?: TurnGames;
}): TurnGames {
  if (env.turnGames === undefined)
    throw new Error('The composition root must inject turn-game rules');
  return env.turnGames;
}
