import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { fireEvent } from '@solidjs/testing-library';
import { contentClient, currentContentEditor } from './content-actions';
import { waitForContent } from './content-sync';
import type { ContentHarness } from './content-system';
import { mountContentExample } from './mount-content-example';

export const seedEqualTimeAttempts = defineAction({
  name: 'seedEqualTimeAttempts',
  act: async (s: ContentHarness) => {
    const source = currentContentEditor(s, 'alice:phone');
    const owner = contentClient(s, 'bob:phone').actorId;
    const ids = Array.from(
      { length: 35 },
      (_, index) => `attempt-${String(index).padStart(2, '0')}`
    );
    const stamp = '2023-11-14T22:13:21.000Z';
    const history =
      '{"entries":[{"action":null,"state":"count:0"}],"cursor":0}';
    await s.server.db.run(
      sql`INSERT INTO puzzle_content_attempts (id, owner_id, puzzle_id, source_id, game_id, mode, pack_revision_id, current_position_id, activity_order, rules_version, created_at, updated_at, deleted_at) VALUES ${join(ids.map((id) => sql`(${id}, ${owner}, ${source.documentId}, ${source.parentId}, ${'counting'}, ${'ordinary'}, ${null}, ${`position-${id}`}, ${0}, ${1}, ${stamp}, ${stamp}, ${null})`))}`
    );
    await s.server.db.run(
      sql`INSERT INTO puzzle_content_positions (id, owner_id, attempt_id, parent_id, history, conflicted, created_at, updated_at, deleted_at) VALUES ${join(ids.map((id) => sql`(${`position-${id}`}, ${owner}, ${id}, ${null}, ${history}, ${false}, ${stamp}, ${stamp}, ${null})`))}`
    );
    await s.server.notifyFanout({
      topics: [`user:${owner}`],
      tables: ['puzzle_content_attempts', 'puzzle_content_positions'],
      label: 'equal-time-attempt-page-fixture',
    });
  },
});

export const loadEarlierAttemptsThroughScreen = defineAction({
  name: 'loadEarlierAttemptsThroughScreen',
  act: async (s: ContentHarness) => {
    const view = await mountContentExample(s, 'bob:phone');
    try {
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryAllByTestId(/^content-attempt-/).length === 32
        )
      );
      fireEvent.click(
        view.getByRole('button', { name: 'Load earlier attempts' })
      );
      await waitForContent(s, () =>
        Promise.resolve(
          view.queryAllByTestId(/^content-attempt-/).length === 35
        )
      );
    } finally {
      view.unmount();
    }
  },
});
