import type { GameDefinition, GameOwnRoom } from '@libs/spaces-shared-ts/game';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';

/** Authored puzzles alone: no position rules, sessions or artificial turn engine. */
export type PuzzleOnlyGame = {
  readonly id: string;
  readonly puzzleContent: PuzzleContent;
  readonly own?: GameOwnRoom;
  readonly rules?: never;
};

/** A game with independent puzzle capabilities and no artificial turn engine. */
export class DefinedPuzzleGame implements GameDefinition {
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

  constructor(game: PuzzleOnlyGame) {
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
