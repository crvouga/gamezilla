import { workingContentDraft } from '@libs/game-puzzle-shared-ts/content-library';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentPreview } from './content-preview';

export function ContentPackPreview(props: { definition: string }): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const pack = createMemo(() => decodePackDefinition(props.definition));
  const [selected, setSelected] = createSignal<string | null>(null);
  const entry = (id: string) => {
    const item = pack()?.items.find((value) => value.puzzleId === id);
    const doc = data.content().documents.find((value) => value.id === id);
    const revision = data
      .content()
      .revisions.find(
        (value) => value.id === (item?.revisionId ?? doc?.published_revision_id)
      );
    return revision ?? workingContentDraft(data.content(), id);
  };
  const preview = () => {
    const id = selected();
    return id === null ? null : entry(id);
  };
  return (
    <StackVertical gap="lg">
      <Show
        when={(pack()?.items.length ?? 0) > 0}
        fallback={
          <EmptyState
            variant="compact"
            title={t`This pack has no puzzles yet`}
            body={t`Return to editing to add a published puzzle or create a new draft.`}
          />
        }
      >
        <MenuSection
          title={<Trans>Pack preview</Trans>}
          footer={
            <Trans>
              People can choose any puzzle. Only published editions can be
              included when you publish this pack.
            </Trans>
          }
        >
          <For each={pack()?.items.map((item) => item.puzzleId) ?? []}>
            {(id) => (
              <MenuRow
                title={(entry(id)?.title ?? '') || t`Unavailable puzzle`}
                selected={selected() === id}
                value={
                  data.content().documents.find((doc) => doc.id === id)
                    ?.status === 'published'
                    ? t`Published`
                    : t`Draft`
                }
                onClick={() => setSelected(id)}
              />
            )}
          </For>
        </MenuSection>
        <Show when={preview()}>
          {(puzzle) => <ContentPreview definition={puzzle().definition} />}
        </Show>
      </Show>
    </StackVertical>
  );
}
