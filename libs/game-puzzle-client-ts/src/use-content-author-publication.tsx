import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { withdrawPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { type Accessor, createMemo } from 'solid-js';
import { contentBuilderStanding } from './content-builder-standing';
import { contentDraftPlayable } from './content-draft-playable';
import { useContentGame } from './content-game-context';
import { useContentPublicationStatus } from './content-publication-status';
import type { useContentDraftSave } from './use-content-draft-save';
import { useContentPublication } from './use-content-publication';
import { useContentPublicationCopyState } from './use-content-publication-copy-state';

/** Withdraws the document's publication; rejects with what to say. */
function useWithdraw(documentId: () => string): () => Promise<void> {
  const { t } = useLingui();
  const mutations = useMutationClient();
  return async () => {
    const result = await mutations.mutate(withdrawPuzzleContentMutation, {
      documentId: documentId(),
    });
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The publication could not be withdrawn. Try again.`
      );
  };
}

/**
 * Where one draft stands on its way to being published, read once for the
 * whole builder: its hub says it, its publish screen acts on it, and its
 * shell keeps the last refusal in view.
 */
export function useContentAuthorPublication(
  document: Accessor<ContentDocument>,
  writer: ReturnType<typeof useContentDraftSave>
) {
  const game = useContentGame();
  const source = {
    get document() {
      return document();
    },
    writer,
  };
  const tools = useContentPublication(source);
  const copyState = useContentPublicationCopyState(source);
  const status = useContentPublicationStatus(() => document().id);
  const withdraw = useWithdraw(() => document().id);
  const playable = () =>
    contentDraftPlayable(
      game.client,
      document().kind,
      writer.body().definition
    );
  const standing = createMemo(() =>
    contentBuilderStanding({
      kind: document().kind,
      validation: tools.draft()?.validation_status ?? null,
      proven: tools.proven(),
      waitingOn: tools.waitingOn(),
      copyState: copyState(),
      playable: playable(),
    })
  );
  return {
    tools,
    copyState,
    status,
    withdraw,
    playable,
    standing,
    /** Opens a pack's first draft puzzle, to finish and publish it there. */
    openWaiting: (): void => {
      const documentId = tools.firstWaiting();
      if (documentId !== undefined) game.open({ kind: 'builder', documentId });
    },
    viewPublication: (): void => {
      const revisionId = document().published_revision_id;
      if (revisionId !== null)
        game.open({ kind: 'edition', revisionId, packRevisionId: null });
    },
  };
}

export type ContentAuthorPublication = ReturnType<
  typeof useContentAuthorPublication
>;
