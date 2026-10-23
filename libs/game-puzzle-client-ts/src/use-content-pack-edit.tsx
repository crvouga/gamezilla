import { createPuzzleFromPackMutation } from '@libs/game-puzzle-shared-ts/create-pack-puzzle-mutation';
import { editPuzzlePackMutation } from '@libs/game-puzzle-shared-ts/edit-pack-mutation';
import type { PackEdit } from '@libs/game-puzzle-shared-ts/pack-edit';
import { useLingui } from '@lingui/solid/macro';
import { createAsync } from '@pkgs/async-root-client-ts/solid';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal } from 'solid-js';
import { useContentGame } from './content-game-context';
import type { useContentDraftSave } from './use-content-draft-save';

export function useContentPackEdit(props: {
  documentId: string;
  writer: ReturnType<typeof useContentDraftSave>;
  onSaved: (id: string) => void;
}) {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [last, setLast] = createSignal<PackEdit | null>(null);
  const [created, setCreated] = createSignal<string | null>(null);
  const change = createAsync({
    operation: async (_context, edit: PackEdit) => {
      await props.writer.save();
      if (props.writer.dirty())
        throw new Error(t`Save the current changes before changing the pack.`);
      const draftId = createId();
      const result = await mutations.mutate(editPuzzlePackMutation, {
        documentId: props.documentId,
        parentId: props.writer.draftId(),
        draftId,
        edit,
      });
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ??
            t`The pack change was not saved. Try again.`
        );
      props.onSaved(draftId);
    },
  });
  const run = (edit: PackEdit): Promise<void> => {
    setLast(edit);
    return change.run(edit);
  };
  const execute = (edit: PackEdit): void => {
    void run(edit).catch(() => undefined);
  };
  const retry = (): void => {
    const edit = last();
    if (edit !== null) execute(edit);
  };
  const create = useMutationButton({
    operation: async () => {
      await props.writer.save();
      const definition = game.client.authoring?.initialDefinition();
      if (props.writer.dirty() || definition === undefined)
        throw new Error(
          t`Save the pack and choose a game with a puzzle editor.`
        );
      const puzzleId = createId();
      const packDraftId = createId();
      const result = await mutations.mutate(
        createPuzzleFromPackMutation(game.catalog),
        {
          packId: props.documentId,
          parentId: props.writer.draftId(),
          packDraftId,
          puzzleId,
          puzzleDraftId: createId(),
          body: {
            title: t`Untitled puzzle`,
            description: '',
            difficulty: '',
            definition,
          },
        }
      );
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ??
            t`The new puzzle could not be kept in this pack. Try again.`
        );
      props.onSaved(packDraftId);
      setCreated(puzzleId);
    },
    labels: {
      idle: t`Create puzzle in this pack`,
      loading: t`Creating…`,
      success: t`Puzzle draft created`,
      error: t`Try creating again`,
    },
  });
  return { change, run, execute, retry, create, created };
}
