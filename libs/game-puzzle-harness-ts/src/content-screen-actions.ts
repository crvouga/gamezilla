import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

/** The creation scenario drives the actual shared builder; its assertions still read durable rows. */
export const createContentThroughScreen = defineAction({
  name: 'createContentThroughScreen',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const view = await mountContentExample(s, clientId);
    try {
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId('content-create-puzzle') !== null)
      );
      fireEvent.click(view.getByTestId('content-create-puzzle'));
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByTestId('content-open-created-draft') !== null
        )
      );
      fireEvent.click(view.getByTestId('content-open-created-draft'));
      await waitForContent(s, () =>
        Promise.resolve(view.queryByLabelText('Title') !== null)
      );
      fireEvent.input(view.getByLabelText('Title'), {
        target: { value: title },
      });
      const db = contentClient(s, clientId).db;
      await waitForContent(s, async () =>
        (await readContentLibrary(db)).drafts.some(
          (draft) => draft.title === title
        )
      );
      const library = await readContentLibrary(db);
      const doc = library.documents.find(
        (entry) => workingContentDraft(library, entry.id)?.title === title
      );
      if (doc === undefined)
        throw new Error('The shared builder did not keep its draft');
      const draft = workingContentDraft(library, doc.id);
      if (draft === null)
        throw new Error('The shared builder has no working copy');
      s.documents.set(title, doc.id);
      s.selectedPuzzles.set(clientId, doc.id);
      s.editors.set(clientId, {
        documentId: doc.id,
        parentId: draft.id,
        body: contentBody(draft),
      });
    } finally {
      view.unmount();
    }
  },
});
