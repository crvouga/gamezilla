import { discoverContent } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentPackEditorView } from './content-pack-editor-view';
import { ContentPackItems } from './content-pack-items';
import type { useContentDraftSave } from './use-content-draft-save';
import type { useContentPackEdit } from './use-content-pack-edit';

type PackEditorProps = {
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
  tools: ReturnType<typeof useContentPackEdit>;
  /** Asks to take a puzzle out; the builder's shell confirms first. */
  onRemove: (puzzleId: string) => void;
};

export function ContentPackEditor(props: PackEditorProps): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  // One operations object belongs to the parent workspace for this editor's lifetime.
  const tools = untrack(() => props.tools);
  const pack = createMemo(() =>
    decodePackDefinition(props.writer.body().definition)
  );
  const available = createMemo(() =>
    discoverContent(data.content(), game.id).filter(
      (entry) =>
        entry.kind === 'puzzle' &&
        !pack()?.items.some((item) => item.puzzleId === entry.document_id)
    )
  );
  const ids = createMemo(
    () => pack()?.items.map((item) => item.puzzleId) ?? []
  );
  const preview = () => {
    const Preview = game.client.Preview;
    return Preview === undefined
      ? undefined
      : (definition: string) => <Preview definition={definition} />;
  };
  const busy = (): boolean => props.disabled || tools.change.loading();
  return (
    <ContentPackEditorView
      readable={pack() !== null}
      count={ids().length}
      order={
        <ContentPackItems
          ids={ids()}
          tools={tools}
          disabled={props.disabled}
          onRemove={(id) => props.onRemove(id)}
        />
      }
      candidates={available().map((entry) => ({
        id: entry.id,
        title: entry.title,
        caption: entry.difficulty,
        preview: entry.definition,
      }))}
      renderPreview={preview()}
      addDisabled={busy()}
      onAdd={(id) => {
        const puzzleId = available().find(
          (revision) => revision.id === id
        )?.document_id;
        if (puzzleId !== undefined) tools.execute({ kind: 'add', puzzleId });
      }}
      notices={
        <>
          <Show when={tools.change.status() === 'success'}>
            <SuccessState variant="compact" title={t`Pack change saved`} />
          </Show>
          <Show when={tools.change.error()}>
            {(error) => (
              <ErrorState
                variant="compact"
                title={t`The pack change was not saved`}
                body={error().message}
                retry={{ onClick: tools.retry }}
              />
            )}
          </Show>
        </>
      }
      create={<CreateInPack tools={tools} disabled={busy()} />}
    />
  );
}

/** A new puzzle draft made inside the pack, then a way into it. */
function CreateInPack(props: {
  tools: ReturnType<typeof useContentPackEdit>;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  return (
    <Show when={game.client.authoring !== undefined}>
      <StackVertical gap="sm" align="start">
        <Button
          {...props.tools.create.buttonProps}
          intent="neutral"
          variant="outline"
          startIcon={<PlusIcon size={20} />}
          dataSet={{ testid: 'content-create-in-pack' }}
          disabled={props.disabled}
        />
        <Show when={props.tools.create.error()}>
          {(error) => (
            <ErrorState
              variant="compact"
              title={t`The puzzle draft was not created`}
              body={error().message}
              retry={{
                onClick: () => {
                  void props.tools.create.run();
                },
              }}
            />
          )}
        </Show>
        <Show when={props.tools.created()}>
          {(id) => (
            <Button
              title={t`Open the new puzzle draft`}
              dataSet={{ testid: 'content-open-pack-puzzle' }}
              intent="neutral"
              variant="outline"
              onClick={() => game.open({ kind: 'builder', documentId: id() })}
            />
          )}
        </Show>
      </StackVertical>
    </Show>
  );
}
