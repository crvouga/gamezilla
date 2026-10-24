import type {
  GameOwnRoom,
  GameDefinition as SpaceGameDefinition,
} from '@libs/spaces-shared-ts/game';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import {
  assertPuzzleContent,
  type PuzzleContent,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { assertGameId } from './assert-game-id';
import {
  isTurnGameDefinition,
  type TurnGameDefinition,
} from './turn-game-definition';

export type Game = {
  readonly id: string;
  readonly puzzleContent: PuzzleContent;
  readonly own?: GameOwnRoom;
};

/** A game with independent puzzle capabilities and no artificial turn engine. */
class DefinedGame implements SpaceGameDefinition {
  readonly #defined = true;
  readonly id: string;
  readonly puzzleContent: PuzzleContent;
  readonly commandRouters: GameOwnRoom['commandRouters'];
  readonly eventRouters: GameOwnRoom['eventRouters'];
  readonly recoverEffects = () => [];
  declare readonly initialState?: () => RoomState;
  declare readonly turnGame?: never;
  declare readonly automation?: never;

  constructor(game: Game) {
    this.id = game.id;
    this.puzzleContent = game.puzzleContent;
    this.commandRouters = game.own?.commandRouters ?? [];
    this.eventRouters = game.own?.eventRouters ?? [];
    if (game.own?.initialState !== undefined)
      this.initialState = game.own.initialState;
  }

  static made(value: unknown): value is DefinedGame {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

/** One registry composes standalone puzzles and turn games, including games offering both. */
export type GameRegistration = DefinedGame | TurnGameDefinition;
export type PuzzleGameDefinition = DefinedGame;

export function defineGame(game: Game): PuzzleGameDefinition {
  assertGameId(game.id);
  assertPuzzleContent(game.id, game.puzzleContent);
  return new DefinedGame(game);
}

export function assertGameDefinitions(
  registry: string,
  definitions: readonly unknown[]
): void {
  for (const [index, definition] of definitions.entries()) {
    if (DefinedGame.made(definition) || isTurnGameDefinition(definition))
      continue;
    throw new Error(
      `${registry}[${index}] was not made by defineGame or defineTurnGame`
    );
  }
}
