import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import type { WordTileBoardCell } from '@pkgs/ui-root-client-ts/word-tile-board';
import { WordTileBlankContext } from '@pkgs/ui-root-client-ts/word-tile-workbench';

function cells(): readonly WordTileBoardCell[] {
  return Array.from({ length: 225 }, (_, index) => {
    const id = `${String.fromCharCode(97 + (index % 15))}${String(Math.floor(index / 15) + 1)}`;
    return {
      id,
      letter: index === 112 ? 'A' : '',
      points: index === 112 ? 0 : null,
      square: null,
      state: index === 112 ? 'tentative' : 'empty',
      label: index === 112 ? `A 0, ${id}, tentative blank` : `${id}, empty`,
      enabled: false,
    };
  });
}

// regression: word-tiles-blank-neighbour-label-unannounced
test('each nearby square around a blank is announced by its label', () => {
  const view = render(() => (
    <WordTileBlankContext
      cells={cells()}
      index={112}
      summary="Scores: Amber 0, Teal 0"
      testId="blank"
    />
  ));
  const group = view.getByRole('group', {
    name: 'Nearby squares; outlined square is your blank',
  });
  const squares = Array.from(group.children);
  expect(squares).toHaveLength(21);
  // aria-label only counts on an element with a role.
  expect(squares.every((square) => square.getAttribute('role') === 'img')).toBe(
    true
  );
  expect(
    view.getByRole('img', { name: 'A 0, h8, tentative blank' })
  ).not.toBeNull();
});
