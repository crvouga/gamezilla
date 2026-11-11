import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { currentContentEditor } from './content-actions';
import { openContentPlace, openLibraryEntry } from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

async function runDraftControl(
  s: ContentHarness,
  control: string
): Promise<void> {
  const clientId = 'alice:phone';
  const editor = currentContentEditor(s, clientId);
  const view = await mountContentExample(s, clientId);
  try {
    const wait = contentWait(s);
    await openLibraryEntry(wait, view, `content-draft-${editor.documentId}`);
    // Validate and Publish are steps of the builder's publish screen.
    await openContentPlace(wait, view, 'publish');
    await waitForContent(s, () => {
      const button = view.queryByTestId(control);
      return Promise.resolve(
        button !== null && !button.matches(':disabled, [aria-disabled="true"]')
      );
    });
    s.lastResult.delete(clientId);
    fireEvent.click(view.getByTestId(control));
    await waitForContent(s, () => Promise.resolve(s.lastResult.has(clientId)));
  } finally {
    view.unmount();
  }
}

export const publishThroughScreen = defineAction({
  name: 'publishThroughScreen',
  act: (s: ContentHarness) => runDraftControl(s, 'content-publish'),
});
export const validateThroughScreen = defineAction({
  name: 'validateThroughScreen',
  act: (s: ContentHarness) => runDraftControl(s, 'content-validate'),
});
