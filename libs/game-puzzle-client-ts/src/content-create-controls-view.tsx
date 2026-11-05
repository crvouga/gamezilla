import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';

export type ContentCreateControlsViewProps = {
  /** Set when the person may not create content; replaces the buttons. */
  readonly denial?: DenialView | undefined;
  /** The game has a puzzle editor, so a puzzle (not only a pack) can be made. */
  readonly canCreatePuzzle: boolean;
  /** Creates a private draft of `kind`; resolves to its document id. */
  readonly onCreate: (kind: ContentKind) => Promise<string>;
  readonly onOpenDraft: (documentId: string) => void;
};

function CreateDraftButton(props: {
  kind: ContentKind;
  onCreate: (kind: ContentKind) => Promise<string>;
  onOpenDraft: (documentId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const [created, setCreated] = createSignal<string | null>(null);
  const button = useMutationButton({
    operation: async () => {
      setCreated(await props.onCreate(props.kind));
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
        intent="neutral"
        variant="outline"
        size="sm"
        startIcon={<PlusIcon size={16} />}
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
            onClick={() => props.onOpenDraft(id())}
            dataSet={{ testid: 'content-open-created-draft' }}
          />
        )}
      </Show>
    </StackVertical>
  );
}

/**
 * Create a private puzzle or pack draft, with each button's progress, a
 * retryable failure and a way into the new draft — or the denial.
 */
export function ContentCreateControlsView(
  props: ContentCreateControlsViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={
        <StackHorizontal gap="sm" wrap>
          <Show when={props.canCreatePuzzle}>
            <CreateDraftButton
              kind="puzzle"
              onCreate={props.onCreate}
              onOpenDraft={props.onOpenDraft}
            />
          </Show>
          <CreateDraftButton
            kind="pack"
            onCreate={props.onCreate}
            onOpenDraft={props.onOpenDraft}
          />
        </StackHorizontal>
      }
    >
      {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
    </Show>
  );
}
