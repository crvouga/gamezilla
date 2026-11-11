import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { selectedPlay } from './attempt-actions';
import { contentClient } from './content-actions';
import {
  openContentPlace,
  openLibraryEntry,
  showContentHome,
} from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

/** Play uses the registered non-grid player within the production shared shell. */
export const playTwoStepsThroughScreen = defineAction({
  name: 'playTwoStepsThroughScreen',
  act: async (s: ContentHarness, clientId: string) => {
    const selection = selectedPlay(s, clientId);
    const view = await mountContentExample(s, clientId);
    try {
      const wait = contentWait(s);
      await openLibraryEntry(
        wait,
        view,
        `content-attempt-${selection.attemptId}`
      );
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId('counting-step-two') !== null)
      );
      fireEvent.click(view.getByTestId('counting-step-two'));
      const db = contentClient(s, clientId).db;
      await waitForContent(s, async () =>
        (await readAttemptLibrary(db)).attempts.some(
          (entry) =>
            entry.id === selection.attemptId &&
            entry.current_position_id !== selection.positionId
        )
      );
      const attempt = (await readAttemptLibrary(db)).attempts.find(
        (entry) => entry.id === selection.attemptId
      );
      if (attempt === undefined)
        throw new Error('The shared player lost its attempt');
      s.playSelections.set(clientId, {
        attemptId: attempt.id,
        positionId: attempt.current_position_id,
      });
      // The completion is recorded where the attempt stands: its progress.
      await openContentPlace(wait, view, 'progress');
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByText(
            attempt.mode === 'playtest' ? 'Playtest solved' : 'Completion saved'
          ) !== null
        )
      );
      await showContentHome(wait, view, 'attempt');
    } finally {
      view.unmount();
    }
  },
});
