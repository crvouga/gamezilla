import { expect, test } from 'bun:test';
import { NumberlinkPlayer } from '@libs/numberlink-client-ts/numberlink-player';
import {
  FIVE_BY_FIVE,
  PATH_1,
  PATH_3,
  PATH_4,
} from '@libs/numberlink-client-ts/numberlink-player.example';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderNumberlink } from './numberlink-client-fixture';

// regression: numberlink-recovery-displaces-undo
// Literal round-four InProgress fixture: two complete paths and a partial third.
test('three paths use one recovery trigger and remove the chosen path only', () => {
  const paths = [
    PATH_1,
    PATH_3,
    { pairId: 'pair-4', cells: PATH_4.cells.slice(0, 2) },
  ];
  const actions: string[] = [];
  const [state, setState] = createSignal(JSON.stringify({ paths }));
  const view = renderNumberlink(() => (
    <NumberlinkPlayer
      definition={JSON.stringify(FIVE_BY_FIVE)}
      state={state()}
      disabled={false}
      onAction={(action) => actions.push(action)}
    />
  ));
  try {
    // regression: numberlink-progress-detached-from-board
    expect(view.getByTestId('numberlink-progress').textContent).toContain(
      '2/5 pairs connected'
    );
    expect(view.getByTestId('numberlink-progress').textContent).toContain(
      '13/25 cells covered'
    );
    expect(view.queryByRole('button', { name: 'Remove path 1' })).toBeNull();
    fireEvent.click(view.getByRole('button', { name: 'Remove a path' }));
    fireEvent.click(view.getByRole('option', { name: 'Remove path 3' }));
    expect(actions.map((action) => JSON.parse(action))).toEqual([
      { pairId: 'pair-3', cells: [] },
    ]);
    setState('{"paths":[]}');
    expect(
      view
        .getByRole('button', { name: 'Remove a path' })
        .hasAttribute('disabled')
    ).toBe(true);
    expect(view.getByTestId('numberlink-progress').textContent).toContain(
      '0/5 pairs connected'
    );
  } finally {
    view.unmount();
  }
});
