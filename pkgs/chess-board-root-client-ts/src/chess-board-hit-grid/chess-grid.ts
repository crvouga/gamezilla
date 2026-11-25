import { isSquare } from '@pkgs/chess-board-core-shared-ts/geometry';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { definePrimitive, elements } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';

type GridOptions = {
  disabled: boolean;
  onSquareActivate: (square: Square) => void;
};

function availability(options: GridOptions) {
  return { disabled: options.disabled };
}

const chessGrid = definePrimitive({
  name: 'chess-grid',
  options: { disabled: 'boolean', onSquareActivate: 'callback' },
  state: availability,
  sync: availability,
  api: (context) => ({
    squares: () =>
      elements(context, 'square').map(({ key, el }) => ({
        value: key,
        label: el.getAttribute('aria-label') ?? key,
      })),
    activateSquare(value: unknown) {
      if (typeof value !== 'string' || !isSquare(value))
        throw new Error('Choose a chess square from a1 through h8.');
      const options = context.options();
      if (options.disabled) throw new Error('This board is read-only.');
      options.onSquareActivate(value);
    },
  }),
  slots: (slot) => ({
    root: slot({ attrs: () => ({ role: 'group' }) }),
    square: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state) => ({
        type: 'button',
        'aria-disabled': String(state.disabled),
      }),
      press: ({ key, api, store }, event) => {
        // The board host already handles pointer gestures.
        if (store.get().disabled) return;
        if (event && 'detail' in event && event.detail !== 0) return;
        api.activateSquare(key);
      },
    }),
  }),
  agent: { actions: ['activateSquare'], items: (api) => api.squares() },
});

export const { Root: ChessGrid, Square: ChessSquare } = createParts(chessGrid, {
  root: 'div',
  square: 'button',
});
