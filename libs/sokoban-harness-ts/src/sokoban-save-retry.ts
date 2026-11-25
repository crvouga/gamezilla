import { contentClient } from '@libs/game-puzzle-harness-ts/content-actions';
import { refusePositionSave } from '@libs/game-puzzle-harness-ts/refuse-position-save';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { playView, waitFor } from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

export const stepRightWithoutSaving = defineAction({
  name: 'stepRightWithoutSaving',
  act: async (s: SokobanHarness, device: string) => {
    const view = playView(s, device);
    const restore = await refusePositionSave(contentClient(s, device).db);
    try {
      fireEvent.keyDown(view.getByTestId('sokoban-board'), {
        key: 'ArrowRight',
      });
      await waitFor(
        s,
        () => view.queryByText('Your change was not saved') !== null
      );
    } finally {
      await restore();
    }
  },
});

export const retryPositionSave = defineAction({
  name: 'retryPositionSave',
  act: async (s: SokobanHarness, device: string) => {
    const view = playView(s, device);
    fireEvent.click(view.getByRole('button', { name: 'Retry' }));
    await waitFor(
      s,
      () =>
        view.getByTestId('content-position-save-status').textContent ===
        'Progress saved on this device.'
    );
  },
});
