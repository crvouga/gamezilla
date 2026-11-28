import { expect, test } from 'bun:test';
import { GAME_TILE_MOTIFS, GameTile } from '@pkgs/ui-root-client-ts/game-tile';
import { For } from 'solid-js';
import { renderUi } from './render';

// regression: game-picker-board-art-replaced-with-emoji
test('each game has its own decorative board miniature in the picker', () => {
  const { container } = renderUi(() => (
    <For each={GAME_TILE_MOTIFS}>
      {(motif) => <GameTile motif={motif} size="xl" />}
    </For>
  ));
  const tiles = container.querySelectorAll('[data-component="GameTile"]');
  expect(tiles).toHaveLength(10);
  const drawings = new Set<string>();
  for (const tile of tiles) {
    expect(tile).toHaveAttribute('aria-hidden', 'true');
    const board = tile.querySelector('svg');
    if (!board)
      throw new Error(`Missing board for ${tile.getAttribute('data-motif')}`);
    expect(board.querySelectorAll('path, rect, circle').length).toBeGreaterThan(
      1
    );
    drawings.add(board.innerHTML);
  }
  expect(drawings.size).toBe(tiles.length);
});
