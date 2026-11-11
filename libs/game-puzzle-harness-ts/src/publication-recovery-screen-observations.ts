import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openContentPlace, openLibraryEntry } from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

async function openRecoveryEditor(s: ContentHarness) {
  const view = await mountContentExample(s, 'alice:phone');
  try {
    await openLibraryEntry(
      contentWait(s),
      view,
      `content-draft-${s.selectedPacks.get('alice:phone')}`
    );
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId('content-author') !== null)
    );
    return view;
  } catch (failure) {
    view.unmount();
    throw failure;
  }
}

export async function publicationRefusalVisible(
  s: ContentHarness
): Promise<boolean> {
  const view = await openRecoveryEditor(s);
  try {
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(Handles.refusedChange) !== null)
    );
    // The refusal belongs to the builder's shell: it is still said on the
    // details screen, where the draft is there to edit.
    await openContentPlace(contentWait(s), view, 'details');
    const notice = view.getByTestId(Handles.refusedChange);
    return (
      notice.getAttribute('data-mutation') === 'publishPuzzleContent' &&
      notice.textContent.includes('no longer available') &&
      view.queryByLabelText('Title') !== null
    );
  } finally {
    view.unmount();
  }
}

export async function publicationWaitingVisible(
  s: ContentHarness
): Promise<boolean> {
  const view = await openRecoveryEditor(s);
  try {
    // What became of the publication is said on the builder's publish screen.
    await openContentPlace(contentWait(s), view, 'publish');
    await waitForContent(s, () =>
      Promise.resolve(
        view.queryByTestId('content-publication-pending') !== null
      )
    );
    return view
      .getByTestId('content-publication-pending')
      .textContent.includes('connection');
  } finally {
    view.unmount();
  }
}
