import type { GameDefinition, GameOwnRoom } from '@libs/spaces-shared-ts/game';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

/** A game offering authored puzzles alone: no positions, execution or turn engine. */
export type PuzzleGame = {
  readonly id: string;
  readonly puzzleContent: PuzzleContent;
  readonly own?: GameOwnRoom;
};

/** A game with independent puzzle capabilities and no artificial turn engine. */
class DefinedPuzzleGame implements GameDefinition {
  readonly #defined = true;
  readonly id: string;
  readonly puzzleContent: PuzzleContent;
  readonly commandRouters: GameOwnRoom['commandRouters'];
  readonly eventRouters: GameOwnRoom['eventRouters'];
  readonly recoverEffects = () => [];
  declare readonly initialState?: () => RoomState;
  declare readonly registration?: never;
  declare readonly turnGame?: never;
  declare readonly automation?: never;

  constructor(game: PuzzleGame) {
    this.id = game.id;
    this.puzzleContent = game.puzzleContent;
    this.commandRouters = game.own?.commandRouters ?? [];
    this.eventRouters = game.own?.eventRouters ?? [];
    if (game.own?.initialState !== undefined)
      this.initialState = game.own.initialState;
  }

  static made(value: unknown): value is DefinedPuzzleGame {
    return typeof value === 'object' && value !== null && #defined in value;
  }
}

export type PuzzleGameDefinition = DefinedPuzzleGame;

/** Only `defineGame` calls this, after checking the game's id and content. */
export function newPuzzleGameDefinition(
  game: PuzzleGame
): PuzzleGameDefinition {
  return new DefinedPuzzleGame(game);
}

export function isPuzzleGameDefinition(
  value: unknown
): value is PuzzleGameDefinition {
  return DefinedPuzzleGame.made(value);
}
