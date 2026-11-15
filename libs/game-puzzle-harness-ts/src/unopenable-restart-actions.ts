import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { fireEvent } from '@solidjs/testing-library';
import { selectedPlay } from './attempt-actions';
import { contentClient } from './content-actions';
import { openLibraryEntry } from './content-screen-places';
import { contentWait, waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

/**
 * The device reads the saved position `positionId` with a history it
 * cannot replay, as a position damaged on the device would read: the
 * attempt's board cannot show it.
 */
function unreadablePosition(engine: SyncEngine, positionId: string) {
  const watch: SyncEngine['watch'] = (query) => {
    const source = engine.watch(query);
    if (!query.sql.includes('FROM puzzle_content_positions')) return source;
    let read: unknown;
    let damaged: ReturnType<typeof source.getSnapshot> = [];
    return {
      ...source,
      getSnapshot: () => {
        const rows = source.getSnapshot();
        if (rows !== read) {
          read = rows;
          damaged = rows.map((row) =>
            row['id'] === positionId ? { ...row, history: '{}' } : row
          );
        }
        return damaged;
      },
    };
  };
  return { ...engine, watch };
}

/**
 * Bob's saved position cannot be opened: from the attempt's own "Restart
 * from the beginning", through the confirm and "Play it", to a playable
 * board in a new attempt, with the earlier attempt still kept.
 */
export const restartUnopenableAttempt = defineAction({
  name: 'restartUnopenableAttempt',
  act: async (s: ContentHarness, clientId: string) => {
    const selection = selectedPlay(s, clientId);
    const client = contentClient(s, clientId);
    const earlier = (await readAttemptLibrary(client.db)).attempts.find(
      (attempt) => attempt.id === selection.attemptId
    );
    if (earlier === undefined) throw new Error('No saved attempt to open');
    const view = await mountContentExample(
      s,
      clientId,
      unreadablePosition(client.engine, earlier.current_position_id)
    );
    try {
      await openLibraryEntry(
        contentWait(s),
        view,
        `content-attempt-${earlier.id}`
      );
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryByTestId('content-unopenable-restart') !== null
        )
      );
      // No board: the move commands are not offered, only what can help.
      s.notices.set(
        'unopenable-offers-moves',
        String(view.queryByTestId('content-undo') !== null)
      );
      // One press: the new attempt starts and opens on its board.
      fireEvent.click(view.getByTestId('content-unopenable-restart'));
      await waitForContent(s, () => {
        const opened = view
          .queryByTestId('content-attempt')
          ?.getAttribute('data-attemptid');
        const step = view.queryByTestId<HTMLButtonElement>('counting-step-one');
        return Promise.resolve(
          opened !== undefined &&
            opened !== null &&
            opened !== earlier.id &&
            step !== null &&
            !step.disabled
        );
      });
      const restarted =
        view.getByTestId('content-attempt').getAttribute('data-attemptid') ??
        '';
      fireEvent.click(view.getByTestId('counting-step-one'));
      await waitForContent(s, async () => {
        const play = await readAttemptLibrary(client.db);
        const fresh = play.attempts.find((attempt) => attempt.id === restarted);
        return (
          fresh !== undefined &&
          play.positions.some(
            (position) =>
              position.attempt_id === restarted &&
              position.id !== fresh.current_position_id
          )
        );
      });
      const play = await readAttemptLibrary(client.db);
      s.notices.set('unopenable-restarted-attempt', restarted);
      s.notices.set(
        'unopenable-earlier-kept',
        String(play.attempts.some((attempt) => attempt.id === earlier.id))
      );
      s.notices.set(
        'unopenable-restart-same-puzzle',
        String(
          play.attempts.find((attempt) => attempt.id === restarted)
            ?.source_id === earlier.source_id
        )
      );
    } finally {
      view.unmount();
    }
  },
});
