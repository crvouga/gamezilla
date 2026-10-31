import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { Trans } from '@lingui/solid/macro';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { ContentPackItem } from './content-pack-item';
import type { useContentDraftSave } from './use-content-draft-save';
import type { useContentPackEdit } from './use-content-pack-edit';

export function ContentPackItems(props: {
  writer: ReturnType<typeof useContentDraftSave>;
  tools: ReturnType<typeof useContentPackEdit>;
  disabled: boolean;
}): JSX.Element {
  const pack = createMemo(() =>
    decodePackDefinition(props.writer.body().definition)
  );
  const ids = createMemo(
    () => pack()?.items.map((item) => item.puzzleId) ?? []
  );
  const [remove, setRemove] = createSignal<string | null>(null);
  const up = (id: string): void => {
    const beforeId = ids()[ids().indexOf(id) - 1];
    if (beforeId !== undefined)
      props.tools.execute({ kind: 'move', puzzleId: id, beforeId });
  };
  const down = (id: string): void => {
    const next = ids()[ids().indexOf(id) + 1];
    if (next !== undefined)
      props.tools.execute({ kind: 'move', puzzleId: next, beforeId: id });
  };
  const removePuzzle = async (): Promise<void> => {
    const id = remove();
    if (id !== null) await props.tools.run({ kind: 'remove', puzzleId: id });
  };
  return (
    <>
      <Show
        when={pack() !== null}
        fallback={
          <Notice tone="error">
            <Trans>
              This pack cannot be read. Choose a kept copy below to continue.
            </Trans>
          </Notice>
        }
      >
        <MenuSection
          title={<Trans>Pack order</Trans>}
          dataSet={{ testid: 'content-pack-order' }}
          footer={
            <Trans>
              People may play these puzzles in any order. Publication pins the
              selected editions.
            </Trans>
          }
        >
          <For each={ids()}>
            {(id, index) => (
              <ContentPackItem
                id={id}
                first={index() === 0}
                last={index() === ids().length - 1}
                disabled={props.disabled || props.tools.change.loading()}
                onUp={() => up(id)}
                onDown={() => down(id)}
                onRemove={() => setRemove(id)}
              />
            )}
          </For>
        </MenuSection>
      </Show>
      <MutationModal
        visible={remove() !== null}
        onClose={() => setRemove(null)}
        title={<Trans>Remove this puzzle from the pack?</Trans>}
        message={
          <Trans>
            The puzzle stays available on its own. Published pack editions keep
            their contents.
          </Trans>
        }
        submitLabel={<Trans>Remove from pack</Trans>}
        variant="destructive"
        successTitle={<Trans>Puzzle removed from the working pack</Trans>}
        operation={removePuzzle}
      />
    </>
  );
}
