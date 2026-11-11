import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import {
  contentPlaceOffered,
  openContentPlace,
  openLibraryEntry,
  pressContentBack,
} from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';
import { movePackRowUp } from './pack-row-menu';

/**
 * Literal race: request the preview at once while the second item moves
 * up. The preview is a row of the builder's hub, so the person goes Back
 * from the pack's puzzles and presses it while the change is still kept.
 */
export const previewDuringPackReorder = defineAction({
  name: 'previewDuringPackReorder',
  act: async (s: ContentHarness) => {
    const view = await mountContentExample(s, 'alice:phone');
    const wait = contentWait(s);
    try {
      const packId = s.documents.get('Rivers');
      const puzzleId = s.documents.get('Valley');
      if (packId === undefined || puzzleId === undefined)
        throw new Error('The ordered Rivers fixture must exist');
      await openLibraryEntry(wait, view, `content-draft-${packId}`);
      await openContentPlace(wait, view, 'board');
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByTestId(`content-pack-item-${puzzleId}`) !== null
        )
      );
      const row = view.getByTestId(`content-pack-item-${puzzleId}`);
      movePackRowUp(view, row);
      // At once, before the change settles: no wait between the two presses.
      pressContentBack(view);
      s.notices.set(
        'pack-preview-pending',
        String(contentPlaceOffered(view, 'preview') === false)
      );
      fireEvent.click(view.getByTestId('content-preview'));
      // The pack's operations outlive the screen that started them.
      await openContentPlace(wait, view, 'board');
      await waitForContent(s, () =>
        Promise.resolve(
          view
            .queryByTestId('content-pack-order')
            ?.textContent.startsWith('Puzzles in this packValley') === true
        )
      );
    } finally {
      view.unmount();
    }
  },
});
