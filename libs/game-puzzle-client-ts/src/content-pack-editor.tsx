import { discoverContent } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { createMemo, For, type JSX, Show, untrack } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentPackItems } from './content-pack-items';
import type { useContentDraftSave } from './use-content-draft-save';
import type { useContentPackEdit } from './use-content-pack-edit';

type PackEditorProps = {
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
  tools: ReturnType<typeof useContentPackEdit>;
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
  return (
    <StackVertical gap="lg">
      <ContentPackItems
        writer={props.writer}
        disabled={props.disabled}
        tools={tools}
      />
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
      <MenuSection title={<Trans>Add a published puzzle</Trans>}>
        <For each={available().map((entry) => entry.id)}>
          {(id) => {
            const entry = () =>
              available().find((revision) => revision.id === id);
            return (
              <MenuRow
                dataSet={{ testid: `content-add-puzzle-${id}` }}
                title={entry()?.title}
                caption={entry()?.difficulty}
                disabled={props.disabled || tools.change.loading()}
                onClick={() => {
                  const puzzleId = entry()?.document_id;
                  if (puzzleId !== undefined)
                    tools.execute({ kind: 'add', puzzleId });
                }}
              />
            );
          }}
        </For>
      </MenuSection>
      <Show when={game.client.authoring !== undefined}>
        <Button
          {...tools.create.buttonProps}
          disabled={props.disabled || tools.change.loading()}
        />
      </Show>
      <Show when={tools.create.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`The puzzle draft was not created`}
            body={error().message}
            retry={{
              onClick: () => {
                void tools.create.run();
              },
            }}
          />
        )}
      </Show>
      <Show when={tools.created()}>
        {(id) => (
          <Button
            title={t`Open the new puzzle draft`}
            intent="neutral"
            variant="outline"
            onClick={() => game.open({ kind: 'edit', documentId: id() })}
          />
        )}
      </Show>
    </StackVertical>
  );
}
