import { createPuzzleContentMutation } from '@libs/game-puzzle-shared-ts/create-content-mutation';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createSignal, type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';

function CreateDraftButton(props: { kind: 'puzzle' | 'pack' }): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const [created, setCreated] = createSignal<string | null>(null);
  const button = useMutationButton({
    operation: async () => {
      const documentId = createId();
      const definition =
        props.kind === 'pack'
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
          kind: props.kind,
          body: {
            title:
              props.kind === 'pack' ? t`Untitled pack` : t`Untitled puzzle`,
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
      setCreated(documentId);
    },
    labels: {
      get idle() {
        return props.kind === 'pack' ? t`Create pack` : t`Create puzzle`;
      },
      loading: t`Creating…`,
      success: t`Draft created`,
      error: t`Try creating again`,
    },
  });
  return (
    <StackVertical gap="sm">
      <Button
        {...button.buttonProps}
        dataSet={{
          testid:
            props.kind === 'pack'
              ? 'content-create-pack'
              : 'content-create-puzzle',
        }}
      />
      <Show when={button.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your draft was not created`}
            body={error().message}
            retry={{
              onClick: () => {
                void button.run();
              },
            }}
          />
        )}
      </Show>
      <Show when={created()}>
        {(id) => (
          <Button
            title={t`Open created draft`}
            intent="neutral"
            variant="outline"
            onClick={() => game.open({ kind: 'edit', documentId: id() })}
            dataSet={{ testid: 'content-open-created-draft' }}
          />
        )}
      </Show>
    </StackVertical>
  );
}

export function ContentCreateControls(): JSX.Element {
  const game = useContentGame();
  const decision = useDecision(PERMISSION.puzzlesCreateContent);
  return (
    <Show
      when={decision().allowed}
      fallback={<DenialSurface decision={decision()} variant="compact" />}
    >
      <StackHorizontal gap="md" wrap>
        <Show when={game.client.authoring !== undefined}>
          <CreateDraftButton kind="puzzle" />
        </Show>
        <CreateDraftButton kind="pack" />
      </StackHorizontal>
    </Show>
  );
}
