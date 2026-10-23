import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import {
  discoverContent,
  readContentLibrary,
} from '@libs/game-puzzle-shared-ts/content-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

export const startPublishedThroughScreen = defineAction({
  name: 'startPublishedThroughScreen',
  act: async (s: ContentHarness, clientId: string, title: string) => {
    const view = await mountContentExample(s, clientId);
    const db = contentClient(s, clientId).db;
    let revisionId = '';
    try {
      await waitForContent(s, async () => {
        const edition = discoverContent(
          await readContentLibrary(db),
          'counting'
        ).find((entry) => entry.title === title);
        if (edition === undefined) return false;
        revisionId = edition.id;
        return view.queryByTestId(`content-published-${revisionId}`) !== null;
      });
      fireEvent.click(view.getByTestId(`content-published-${revisionId}`));
      await waitForContent(s, () =>
        Promise.resolve(
          view
            .queryByTestId('content-start-attempt')
            ?.hasAttribute('disabled') === false
        )
      );
      fireEvent.click(view.getByTestId('content-start-attempt'));
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId('content-continue-attempt') !== null)
      );
      fireEvent.click(view.getByTestId('content-continue-attempt'));
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId('counting-step-two') !== null)
      );
      const attempt = (await readAttemptLibrary(db)).attempts.find(
        (entry) => entry.source_id === revisionId && entry.mode === 'ordinary'
      );
      if (attempt === undefined)
        throw new Error('The shared screen did not keep its attempt');
      s.playSelections.set(clientId, {
        attemptId: attempt.id,
        positionId: attempt.current_position_id,
      });
    } finally {
      view.unmount();
    }
  },
});
