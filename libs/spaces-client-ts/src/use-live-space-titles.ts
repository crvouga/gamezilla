import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { spaceTitleText } from '@libs/moderation-shared-ts/display';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

type LiveTitleRow = { readonly id: string; readonly title: string | null };

/**
 * The own names of the live spaces this device can see, moderated, by
 * space id: what a friend's status line calls the room they are in
 * ("Hosting Friday game night"). A space that goes by "<host>'s space" has
 * no entry.
 */
export function useLiveSpaceTitles(): Accessor<ReadonlyMap<string, string>> {
  const moderation = useModeration();
  const query = createQuery(
    () => sql<LiveTitleRow>`
      SELECT id, title
      FROM spaces
      WHERE ended_at IS NULL AND deleted_at IS NULL
    `
  );
  return createMemo(() => {
    const titles = new Map<string, string>();
    for (const row of query.rows()) {
      const title = spaceTitleText(moderation(), row.title, row.id);
      if (title !== null && title.length > 0) titles.set(row.id, title);
    }
    return titles;
  });
}
