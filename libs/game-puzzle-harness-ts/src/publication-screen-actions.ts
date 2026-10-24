import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { currentContentEditor } from './content-actions';
import { waitForContent } from './content-sync';
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
    const openId = `content-draft-${editor.documentId}`;
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(openId) !== null)
    );
    fireEvent.click(view.getByTestId(openId));
    await waitForContent(s, () =>
      Promise.resolve(view.queryByTestId(control) !== null)
    );
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
