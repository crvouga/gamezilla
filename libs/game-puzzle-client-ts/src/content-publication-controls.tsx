import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { withdrawPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/withdraw-content-mutation';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import type { Accessor, JSX } from 'solid-js';
import { contentDraftPlayable } from './content-draft-playable';
import { useContentGame } from './content-game-context';
import { ContentPublicationControlsView } from './content-publication-controls-view';
import { useContentPublicationStatus } from './content-publication-status';
import type { useContentDraftSave } from './use-content-draft-save';
import { useContentPublication } from './use-content-publication';
import { useContentPublicationCopyState } from './use-content-publication-copy-state';
import { useDeniedView } from './use-denied-view';

function validationMessage(draft: ContentDraft | undefined): string {
  if (draft?.validation_status !== 'invalid') return '';
  try {
    const issues: unknown = JSON.parse(draft.validation_issues);
    return Array.isArray(issues)
      ? issues
          .flatMap((issue) =>
            typeof issue === 'object' &&
            issue !== null &&
            'message' in issue &&
            typeof issue.message === 'string'
              ? [issue.message]
              : []
          )
          .join(' ')
      : '';
  } catch {
    return '';
  }
}

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
 * Validation and publication wired to the draft, permissions and sync, laid
 * out for the builder's publish footer; `before` (a puzzle's playtest) comes
 * first among its actions.
 */
export function ContentPublicationControls(props: {
  document: ContentDocument;
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
  before?: ((next: Accessor<boolean>) => JSX.Element) | undefined;
}): JSX.Element {
  const tools = useContentPublication(props);
  const copyState = useContentPublicationCopyState(props);
  const game = useContentGame();
  const status = useContentPublicationStatus(() => props.document.id);
  const withdraw = useWithdraw(() => props.document.id);
  const decision = useDecision(PERMISSION.puzzlesPublishContent, () => ({
    puzzleOwnerId: props.document.owner_id,
  }));
  const publishDenial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  return (
    <ContentPublicationControlsView
      layout="bar"
      before={props.before}
      kind={props.document.kind}
      validation={tools.draft()?.validation_status ?? null}
      validationMessage={validationMessage(tools.draft())}
      proven={tools.proven()}
      waitingOn={tools.waitingOn()}
      pending={status.pending()}
      copyState={copyState()}
      refusal={status.refusal()}
      publishDenial={publishDenial()}
      published={props.document.published_revision_id !== null}
      disabled={props.disabled}
      playable={contentDraftPlayable(
        game.client,
        props.document.kind,
        props.writer.body().definition
      )}
      onValidate={tools.validate}
      onPublish={tools.publish}
      onViewPublication={() => {
        const revisionId = props.document.published_revision_id;
        if (revisionId !== null)
          game.open({ kind: 'edition', revisionId, packRevisionId: null });
      }}
      onWithdraw={withdraw}
      onOpenWaiting={() => {
        const documentId = tools.firstWaiting();
        if (documentId !== undefined) game.open({ kind: 'edit', documentId });
      }}
    />
  );
}
