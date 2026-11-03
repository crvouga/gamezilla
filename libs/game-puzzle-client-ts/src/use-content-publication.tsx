import { contentDraftProof } from '@libs/game-puzzle-shared-ts/content-proof';
import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { publishPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/publish-content-mutation';
import { validatePuzzleContentDraftMutation } from '@libs/game-puzzle-shared-ts/validate-content-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import type { useContentDraftSave } from './use-content-draft-save';

export type ContentPublicationProps = {
  document: ContentDocument;
  writer: ReturnType<typeof useContentDraftSave>;
};

/** Validate or publish the saved working copy, and whether it is proven. */
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
  return {
    draft,
    validate: () => run(false),
    publish: () => run(true),
    proven: () => currentProof() !== null,
  };
}
