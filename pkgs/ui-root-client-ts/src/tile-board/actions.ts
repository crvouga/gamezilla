import { definePrimitive } from '@ui-sdk/core';
import { usePrimitive } from '@ui-sdk/solid/primitive';
import type { TileBoardProps } from './index';

const directions = ['up', 'down', 'left', 'right'] as const;
type BoardOptions = Pick<
  TileBoardProps,
  'tiles' | 'onDirection' | 'onTile' | 'disabled'
>;

function boardState(board: BoardOptions) {
  return {
    disabled: board.disabled === true || (!board.onTile && !board.onDirection),
  };
}

const board = definePrimitive({
  name: 'tile-board',
  options: {
    tiles: 'value',
    onDirection: 'callback',
    onTile: 'callback',
    disabled: 'boolean',
  },
  state: boardState,
  sync: boardState,
  api: (context) => ({
    items() {
      const options = context.options();
      return [
        ...(options.onDirection
          ? directions.map((value) => ({ value, label: value }))
          : []),
        ...(options.onTile
          ? options.tiles.map((tile, index) => ({
              value: String(index),
              label: tile.label,
            }))
          : []),
      ];
    },
    select(choice: unknown) {
      const options = context.options();
      if (boardState(options).disabled) return;
      const direction = directions.find((value) => value === choice);
      if (direction && options.onDirection) {
        options.onDirection(direction);
        return;
      }
      const index = options.tiles.findIndex(
        (tile, i) => tile.label === choice || String(i) === choice
      );
      if (index < 0 || !options.onTile)
        throw new Error(
          'Choose a direction or tile from the board’s current choices.'
        );
      options.onTile(index);
    },
  }),
  agent: { actions: ['select'], items: (api) => api.items(), closed: true },
  slots: (slot) => ({ root: slot({}) }),
});

export function useTileBoardActions(props: BoardOptions) {
  return usePrimitive(board, () => ({
    tiles: props.tiles,
    disabled: props.disabled,
    onTile: props.onTile,
    onDirection: props.onDirection,
  })).slot('root');
}
