import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';
import type { ContentView } from './content-game-context';

export type ContentIdPage = {
  readonly afterIds: Accessor<readonly string[]>;
  readonly limit: Accessor<number>;
  readonly hasMore: Accessor<boolean>;
  readonly more: () => void;
};
export const byContentId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function createIdPage(
  rows: Accessor<readonly { id: string }[]>,
  key?: Accessor<string>
): ContentIdPage {
  const [afterIds, setAfterIds] = createSignal<readonly string[]>(['']);
  const limit = createMemo(() => afterIds().length * CONTENT_PAGE_SIZE);
  const ordered = createMemo(() => rows().toSorted(byContentId));
  const hasMore = () => ordered().length >= limit();
  if (key !== undefined)
    createEffect(on(key, () => setAfterIds(['']), { defer: true }));
  const more = (): void => {
    const last = ordered()[limit() - 1];
    if (hasMore() && last !== undefined && !afterIds().includes(last.id))
      setAfterIds((prior) => [...prior, last.id]);
  };
  return { afterIds, limit, hasMore, more };
}

export function useContentPages(
  content: Accessor<ContentLibrary>,
  play: Accessor<AttemptLibrary>,
  view: Accessor<ContentView>
) {
  const myId = useMyId();
  const published = createIdPage(() =>
    content().documents.filter((doc) => doc.published_revision_id !== null)
  );
  const owned = createIdPage(() =>
    content().documents.filter((doc) => doc.owner_id === myId())
  );
  const draftDocument = () => {
    const current = view();
    return current.kind === 'edit' ? current.documentId : '';
  };
  const positionAttempt = () => {
    const current = view();
    return current.kind === 'attempt' ? current.attemptId : '';
  };
  const drafts = createIdPage(
    () =>
      content().drafts.filter((draft) => draft.document_id === draftDocument()),
    draftDocument
  );
  const positions = createIdPage(
    () =>
      play().positions.filter(
        (position) => position.attempt_id === positionAttempt()
      ),
    positionAttempt
  );
  const [attemptCursors, setAttemptCursors] = createSignal<
    readonly { beforeAt: string; beforeId: string }[]
  >([{ beforeAt: '9999-12-31T23:59:59.999Z', beforeId: '' }]);
  const attemptLimit = () => attemptCursors().length * CONTENT_PAGE_SIZE;
  const moreAttempts = (): void => {
    const last = play().attempts[attemptLimit() - 1];
    if (last !== undefined)
      setAttemptCursors((prior) => [
        ...prior,
        { beforeAt: last.updated_at, beforeId: last.id },
      ]);
  };
  return {
    published,
    owned,
    drafts,
    positions,
    attempts: {
      cursors: attemptCursors,
      limit: attemptLimit,
      hasMore: () => play().attempts.length >= attemptLimit(),
      more: moreAttempts,
    },
  };
}
export type ContentPages = ReturnType<typeof useContentPages>;
