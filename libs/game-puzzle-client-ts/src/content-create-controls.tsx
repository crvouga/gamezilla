import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import type { JSX } from 'solid-js';
import { ContentCreateControlsView } from './content-create-controls-view';
import { useContentGame } from './content-game-context';
import { useDeniedView } from './use-denied-view';

/** Creates a private draft of `kind` and resolves to its document id. */
function useCreateDraft(): (kind: ContentKind) => Promise<string> {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  return async (kind) => {
    const documentId = createId();
    const definition =
      kind === 'pack'
        ? '{"items":[]}'
        : game.client.authoring?.initialDefinition();
    if (definition === undefined)
      throw new Error(t`Choose a game with a puzzle editor.`);
    const result = await mutations.mutate(
      createPuzzleContentMutation(game.catalog),
      {
        documentId,
        draftId: createId(),
        gameId: game.id,
        kind,
        body: {
          title: kind === 'pack' ? t`Untitled pack` : t`Untitled puzzle`,
          description: '',
          difficulty: '',
          definition,
        },
      }
    );
    if (!result.ok)
      throw new Error(
        result.failures[0]?.message ??
          t`The draft could not be created. Try again.`
      );
    return documentId;
  };
}

/** Create controls wired to the create permission and mutation. */
export function ContentCreateControls(): JSX.Element {
  const game = useContentGame();
  const decision = useDecision(PERMISSION.puzzlesCreateContent);
  const createDraft = useCreateDraft();
  const denial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  return (
    <ContentCreateControlsView
      denial={denial()}
      canCreatePuzzle={game.client.authoring !== undefined}
      onCreate={createDraft}
      onOpenDraft={(documentId) => game.open({ kind: 'edit', documentId })}
    />
  );
}
