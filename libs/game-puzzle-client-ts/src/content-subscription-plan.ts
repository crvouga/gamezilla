import type { AttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import type { SyncEngineQuerySubscriptionSpec } from '@pkgs/sync-engine-client-ts/subscribe-queries-types';
import type { ContentView } from './content-game-context';
import type { ContentPages } from './use-content-pages';

type Plan = SyncEngineQuerySubscriptionSpec[];
type Selection = {
  gameId: string;
  view: ContentView;
  content: ContentLibrary;
  play: AttemptLibrary;
  pages: ContentPages;
};

function batches(name: string, ids: readonly string[], key = 'ids'): Plan {
  const sorted = [...new Set(ids)].sort();
  const requests: Plan = [];
  for (let start = 0; start < sorted.length; start += CONTENT_PAGE_SIZE)
    requests.push({
      name,
      params: { [key]: sorted.slice(start, start + CONTENT_PAGE_SIZE) },
    });
  return requests;
}

function selectedRoots(selection: Selection) {
  const view = selection.view;
  const attempt =
    view.kind === 'attempt'
      ? selection.play.attempts.find((entry) => entry.id === view.attemptId)
      : undefined;
  const rootIds =
    view.kind === 'edition'
      ? [
          view.revisionId,
          ...(view.packRevisionId === null ? [] : [view.packRevisionId]),
        ]
      : attempt === undefined
        ? []
        : [
            ...(attempt.mode === 'ordinary' ? [attempt.source_id] : []),
            ...(attempt.pack_revision_id === null
              ? []
              : [attempt.pack_revision_id]),
          ];
  const document =
    view.kind === 'edit'
      ? selection.content.documents.find(
          (entry) => entry.id === view.documentId
        )
      : undefined;
  const draft = selection.content.drafts.find(
    (entry) => entry.id === document?.working_draft_id
  );
  const definitions = selection.content.revisions
    .filter(
      (edition) => rootIds.includes(edition.id) && edition.kind === 'pack'
    )
    .map((edition) => edition.definition);
  if (document?.kind === 'pack' && draft !== undefined)
    definitions.push(draft.definition);
  const items = definitions.flatMap(
    (definition) => decodePackDefinition(definition)?.items ?? []
  );
  return { attempt, rootIds, items };
}

/** Describes requested content only; subscriptions never enumerate the whole catalogue or history. */
export function contentSubscriptionPlan(selection: Selection): Plan {
  const { gameId, view, pages } = selection;
  const roots = selectedRoots(selection);
  const requests: Plan = [
    ...pages.published.afterIds().map((afterId) => ({
      name: 'puzzleContentPublished',
      params: { gameId, afterId },
    })),
    ...pages.owned.afterIds().map((afterId) => ({
      name: 'puzzleContentOwned',
      params: { gameId, afterId },
    })),
    ...pages.attempts.cursors().map((cursor) => ({
      name: 'puzzleContentAttemptsOwned',
      params: { gameId, ...cursor },
    })),
  ];
  if (view.kind === 'edit')
    requests.push(
      {
        name: 'puzzleContentOwned',
        params: { gameId, documentId: view.documentId },
      },
      ...pages.drafts.afterIds().map((afterId) => ({
        name: 'puzzleContentDraftCopies',
        params: { documentId: view.documentId, afterId },
      }))
    );
  if (view.kind === 'attempt')
    requests.push(
      {
        name: 'puzzleContentAttemptsOwned',
        params: { gameId, attemptId: view.attemptId },
      },
      ...pages.positions.afterIds().map((afterId) => ({
        name: 'puzzleContentPositionsOwned',
        params: { attemptId: view.attemptId, afterId },
      }))
    );
  if (view.kind === 'edition')
    requests.push({
      name: 'puzzleContentAttemptsOwned',
      params: { gameId, sourceId: view.revisionId },
    });
  const editionIds = [
    ...roots.rootIds,
    ...roots.items.flatMap((item) =>
      item.revisionId === null ? [] : [item.revisionId]
    ),
  ];
  const packIds = roots.rootIds.filter((id) =>
    selection.content.revisions.some(
      (entry) => entry.id === id && entry.kind === 'pack'
    )
  );
  requests.push(
    ...batches('puzzleContentEditions', editionIds),
    ...batches(
      'puzzleContentDocumentsById',
      roots.items
        .filter((item) => item.revisionId === null)
        .map((item) => item.puzzleId)
    ),
    ...batches('puzzleContentCompletionsOwned', editionIds, 'revisionIds')
  );
  for (const revisionId of packIds)
    requests.push(
      { name: 'puzzleContentPackItems', params: { revisionId } },
      {
        name: 'puzzleContentAttemptsOwned',
        params: { gameId, packRevisionId: revisionId, unfinishedOnly: true },
      }
    );
  return requests;
}
