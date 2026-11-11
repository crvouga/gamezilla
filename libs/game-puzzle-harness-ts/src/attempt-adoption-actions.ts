import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
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

/** Deliver position rows before the independent current-attempt query. */
function delayedHeads(engine: SyncEngine) {
  let held = false;
  const listeners = new Set<() => void>();
  const watch: SyncEngine['watch'] = (query) => {
    const source = engine.watch(query);
    if (!query.sql.includes('FROM puzzle_content_attempts WHERE game_id'))
      return source;
    let snapshot = source.getSnapshot();
    return {
      getHydrated: source.getHydrated,
      getSnapshot: () => {
        if (!held) snapshot = source.getSnapshot();
        return snapshot;
      },
      subscribe: (listener) => {
        const publish = () => {
          if (!held) listener();
        };
        listeners.add(publish);
        const stop = source.subscribe(publish);
        return () => {
          listeners.delete(publish);
          stop();
        };
      },
    };
  };
  return {
    engine: { ...engine, watch },
    hold: () => {
      held = true;
    },
    release: () => {
      held = false;
      for (const listener of listeners) listener();
    },
  };
}

export const observeAttemptAdoption = defineAction({
  name: 'observeAttemptAdoption',
  act: async (s: ContentHarness, clientId: string) => {
    const selection = selectedPlay(s, clientId);
    const client = contentClient(s, clientId);
    const delivery = delayedHeads(client.engine);
    const view = await mountContentExample(s, clientId, delivery.engine);
    const button = () =>
      view.getByTestId<HTMLButtonElement>('counting-step-one');
    try {
      const wait = contentWait(s);
      await openLibraryEntry(
        wait,
        view,
        `content-attempt-${selection.attemptId}`
      );
      await waitForContent(s, () =>
        Promise.resolve(view.queryByTestId('counting-step-one') !== null)
      );
      delivery.hold();
      fireEvent.click(button());
      // The saved positions are listed where the attempt stands: its progress.
      await openContentPlace(wait, view, 'progress');
      await waitForContent(s, async () => {
        const library = await readAttemptLibrary(client.db);
        return (
          library.positions.some(
            (position) =>
              position.attempt_id === selection.attemptId &&
              position.id !== selection.positionId
          ) && view.queryAllByText(/Saved position/).length >= 2
        );
      });
      // Back on the board, the player still waits for the attempt's head.
      await showContentHome(wait, view, 'attempt');
      s.notices.set('attempt-waits-for-head', String(button().disabled));
      delivery.release();
      await waitForContent(s, () => Promise.resolve(!button().disabled));
      fireEvent.click(button());
      await openContentPlace(wait, view, 'progress');
      await waitForContent(s, () =>
        Promise.resolve(view.queryByText('Completion saved') !== null)
      );
      s.notices.set('attempt-continued-from-saved-head', 'true');
    } finally {
      delivery.release();
      view.unmount();
    }
  },
});
