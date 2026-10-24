import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createMemo, For, type JSX } from 'solid-js';
import { useContentLibraryState } from './content-library-context';
import { ContentLoadMore } from './content-load-more';
import { useContentCopyChoice } from './use-content-copy-choice';
import { byContentId } from './use-content-pages';

export function ContentKeptCopies(props: {
  document: ContentDocument;
  disabled: boolean;
  currentId: string;
  onChoose: (draft: ContentDraft) => void;
}): JSX.Element {
  const { t } = useLingui();
  const data = useContentLibraryState();
  const copies = createMemo(() =>
    data
      .content()
      .drafts.filter((draft) => draft.document_id === props.document.id)
  );
  const ids = createMemo(() => [
    ...new Set([
      ...copies()
        .toSorted(byContentId)
        .slice(0, data.pages.drafts.limit())
        .map((draft) => draft.id),
      props.currentId,
    ]),
  ]);
  const choice = useContentCopyChoice(props);
  return (
    <>
      <MenuSection
        title={<Trans>Kept copies</Trans>}
        footer={
          <Trans>
            Choosing a copy keeps earlier work and leaves published editions
            unchanged.
          </Trans>
        }
      >
        <For each={ids()}>
          {(id) => (
            <MenuRow
              title={
                (copies().find((draft) => draft.id === id)?.title ?? '') ||
                t`Untitled draft`
              }
              caption={
                copies().find((draft) => draft.id === id)?.conflicted
                  ? t`Different work was kept from another device`
                  : t`Saved draft copy`
              }
              selected={id === props.currentId}
              value={id === props.currentId ? t`Current` : t`Use copy`}
              disabled={props.disabled || id === props.currentId}
              onClick={() => choice.select(id)}
              dataSet={{ testid: `content-use-copy-${id}` }}
            />
          )}
        </For>
      </MenuSection>
      <ContentLoadMore
        page={data.pages.drafts}
        label={t`Load more kept copies`}
        disabled={props.disabled}
      />
      <MutationModal
        visible={choice.visible()}
        onClose={choice.close}
        title={<Trans>Use this kept copy?</Trans>}
        message={
          <Trans>
            A new working copy will use these details. Your other saved copies
            remain available.
          </Trans>
        }
        operation={choice.choose}
        submitLabel={<Trans>Use copy</Trans>}
        successTitle={<Trans>Working copy chosen</Trans>}
        submitDisabled={props.disabled}
      />
    </>
  );
}
