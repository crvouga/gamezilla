import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { openBuilder, settleBuilder } from './builder-session';
import { contentClient, currentContentEditor } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';

/**
 * Consecutive inputs run without an intermediate wait, exercising autosave
 * coalescing. The builder stays open, as it does for a person who saved.
 */
export const saveMetadataThroughScreen = defineAction({
  name: 'saveMetadataThroughScreen',
  act: async (s: ContentHarness, clientId: string) => {
    const editor = currentContentEditor(s, clientId);
    const view = await openBuilder(s, clientId, editor.documentId);
    fireEvent.input(view.getByLabelText('Title'), {
      target: { value: editor.body.title },
    });
    fireEvent.input(view.getByLabelText('Description'), {
      target: { value: editor.body.description },
    });
    fireEvent.input(view.getByLabelText('Difficulty (optional)'), {
      target: { value: editor.body.difficulty },
    });
    const db = contentClient(s, clientId).db;
    try {
      await waitForContent(s, async () => {
        const draft = workingContentDraft(
          await readContentLibrary(db),
          editor.documentId
        );
        return (
          draft !== null &&
          JSON.stringify(contentBody(draft)) === JSON.stringify(editor.body)
        );
      });
    } catch (cause) {
      throw new Error(
        `Shared draft autosave did not settle: ${JSON.stringify({ expected: editor.body, library: await readContentLibrary(db), lastResult: s.lastResult.get(clientId), screen: view.container.textContent })}`,
        { cause }
      );
    }
    await settleBuilder(s, clientId);
  },
});
