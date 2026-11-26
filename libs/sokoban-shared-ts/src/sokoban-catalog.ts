import type { BundledPuzzlePack } from '@pkgs/turn-game-shared-ts/puzzle-content';
import warehouses from './catalog/warehouses.json';

export const sokobanWarehousePacks: readonly BundledPuzzlePack[] =
  warehouses.map((pack) => ({
    id: pack.id,
    title: pack.title,
    description: pack.description,
    puzzles: pack.puzzles.map((puzzle) => ({
      id: puzzle.id,
      title: puzzle.title,
      description: '',
      difficulty: pack.difficulty,
      definition: puzzle.board,
      witness: [...puzzle.solution],
    })),
  }));
