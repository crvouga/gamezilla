import { contentDraftProof } from '@libs/game-puzzle-shared-ts/content-proof';
import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { validatePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/validate-content-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import type { useContentDraftSave } from './use-content-draft-save';

export type ContentPublicationProps = {
  document: ContentDocument;
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
};

export function useContentPublication(props: ContentPublicationProps) {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const mutations = useMutationClient();
  const draft = () =>
    data.content().drafts.find((entry) => entry.id === props.writer.draftId());
  // The saved row can arrive after the body it holds: prove the body itself.
  const currentProof = () =>
    contentDraftProof({
      content: data.content(),
      play: data.play(),
      game: game.content,
      draft: {
        document_id: props.document.id,
        definition: props.writer.body().definition,
        validation_solution:
          draft()?.definition === props.writer.body().definition
            ? (draft()?.validation_solution ?? null)
            : null,
      },
    });
  const run = async (publish: boolean): Promise<void> => {
    await props.writer.save();
    if (props.writer.dirty())
      throw new Error(
        t`Keep the current changes before publishing. Try saving again.`
      );
    const proof = currentProof();
    const args = {
      documentId: props.document.id,
      draftId: props.writer.draftId(),
      ...(proof?.kind === 'playtest'
        ? { playtestAttemptId: proof.attemptId }
        : {}),
    };
    const result = await mutations.mutate(
      publish
        ? publishPuzzleContentMutation(game.catalog)
        : validatePuzzleContentDraftMutation(game.catalog),
      args
    );
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The draft could not be checked. Try again.`
      );
  };
  const validate = useMutationButton({
    operation: () => run(false),
    labels: {
      idle: t`Validate`,
      loading: t`Checking…`,
      success: t`Check finished`,
      error: t`Check again`,
    },
    get disabled() {
      return props.disabled;
    },
  });
  const publish = useMutationButton({
    operation: () => run(true),
    labels: {
      idle: t`Publish`,
      loading: t`Publishing…`,
      success: t`Publication saved`,
      error: t`Try publishing again`,
    },
    get disabled() {
      return props.disabled;
    },
  });
  return {
    draft,
    validate,
    publish,
    proven: () => currentProof() !== null,
  };
}
