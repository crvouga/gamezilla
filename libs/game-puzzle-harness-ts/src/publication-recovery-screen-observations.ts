import { Handles } from '@libs/test-ids-shared-ts/handles';
import { fireEvent } from '@solidjs/testing-library';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

async function openRecoveryEditor(s: ContentHarness) {
  const view = await mountContentExample(s, 'alice:phone');
  try {
    const id = `content-draft-${s.selectedPacks.get('alice:phone')}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(id) !== null)
    );
    fireEvent.click(view.getByTestId(id));
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
