import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

/** Literal race: immediately request preview while the second item moves up. */
export const previewDuringPackReorder = defineAction({
  name: 'previewDuringPackReorder',
  act: async (s: ContentHarness) => {
    const view = await mountContentExample(s, 'alice:phone');
    try {
      const packId = s.documents.get('Rivers');
      const puzzleId = s.documents.get('Valley');
      if (packId === undefined || puzzleId === undefined)
        throw new Error('The ordered Rivers fixture must exist');
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId(`content-draft-${packId}`) !== null)
      );
      fireEvent.click(view.getByTestId(`content-draft-${packId}`));
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByTestId(`content-pack-item-${puzzleId}`) !== null
        )
      );
      const row = view.getByTestId(`content-pack-item-${puzzleId}`);
      const up = row.querySelector<HTMLButtonElement>(
        '[data-testid="content-pack-up"]'
      );
      if (up === null) throw new Error('The second item must offer moving up');
      fireEvent.click(up);
      const preview = view.getByTestId('content-preview') as HTMLButtonElement;
      s.notices.set('pack-preview-pending', String(preview.disabled));
      preview.click();
      await waitForContent(s, () =>
        Promise.resolve(
          view
            .queryByTestId('content-pack-order')
            ?.textContent.startsWith('Pack orderValley') === true
        )
      );
    } finally {
      view.unmount();
    }
  },
});
