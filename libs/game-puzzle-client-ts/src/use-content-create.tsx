import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createSignal } from 'solid-js';
import { useContentGame } from './content-game-context';

/**
 * Where creating a draft stands: nothing asked, a draft of `kind` being
 * made, made (its document waits to be opened), or refused with why.
 */
export type ContentCreateState =
  | { readonly status: 'idle' }
  | { readonly status: 'creating'; readonly kind: ContentKind }
  | {
      readonly status: 'created';
      readonly kind: ContentKind;
      readonly documentId: string;
    }
  | {
      readonly status: 'failed';
      readonly kind: ContentKind;
      readonly message: string;
    };

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

/**
 * Creating a private puzzle or pack draft from the library's hub, as one
 * named state; a second request waits for the first to settle.
 */
export function useContentCreate(): {
  readonly state: Accessor<ContentCreateState>;
  readonly create: (kind: ContentKind) => void;
} {
  const { t } = useLingui();
  const createDraft = useCreateDraft();
  const [state, setState] = createSignal<ContentCreateState>({
    status: 'idle',
  });
  const create = (kind: ContentKind): void => {
    if (state().status === 'creating') return;
    setState({ status: 'creating', kind });
    createDraft(kind).then(
      (documentId) => setState({ status: 'created', kind, documentId }),
      (failure: unknown) =>
        setState({
          status: 'failed',
          kind,
          message:
            failure instanceof Error
              ? failure.message
              : t`The draft could not be created. Try again.`,
        })
    );
  };
  return { state, create };
}
