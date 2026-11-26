import type { BundledPuzzlePack } from '@pkgs/turn-game-shared-ts/puzzle-content';
import catalog from './numberlink-catalog.json';
import { type CatalogEntry, CatalogPuzzle } from './numberlink-catalog-puzzle';

/**
 * The shipped packs, read from `numberlink-catalog.json`. Each entry is a
 * stable two-digit id within its pack, its board in notation (`NL1:`) and
 * the solved board: the same rows with every cell carrying the letter of
 * the path through it (`.` where pairs-only coverage leaves it empty).
 */
type CatalogPack = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly puzzles: readonly CatalogEntry[];
};

function packOf(pack: CatalogPack): BundledPuzzlePack {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    puzzles: pack.puzzles.map((entry) => new CatalogPuzzle(pack, entry)),
  };
}

/** The compact file as it ships, for tools that read or check entries. */
export const numberlinkCatalogSource: {
  readonly format: number;
  readonly packs: readonly CatalogPack[];
} = catalog;

/** Ordered from the first small boards to the largest. */
export const numberlinkCatalogPacks: readonly BundledPuzzlePack[] =
  catalog.packs.map(packOf);
