import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { ContentRowCaption, ContentStatusChip } from './content-chips';
import { ContentThumbnail } from './content-thumbnail';

/** A published puzzle the pack does not hold yet. */
export type ContentPackCandidate = {
  /** The published edition's id. */
  readonly id: string;
  readonly title: string;
  readonly caption: string;
  /** The puzzle's definition, drawn as the row's thumbnail. */
  readonly preview?: string | undefined;
};

export type ContentPackItemRowProps = {
  /** The puzzle's document id. */
  readonly id: string;
  readonly title: string;
  /** What the author still has to do with it; empty when nothing. */
  readonly caption: string;
  /** Published, or still a draft: a status chip under the title. */
  readonly status?: 'published' | 'draft' | undefined;

  readonly first: boolean;
  readonly last: boolean;
  readonly disabled: boolean;
  /** `edit` for the author's own puzzle; `view` opens its published edition. */
  readonly open: 'edit' | 'view' | null;
  readonly onOpen: () => void;
  readonly onUp: () => void;
  readonly onDown: () => void;
  readonly onRemove: () => void;
};

const ROW_CONTROL = 32;

/**
 * One puzzle in the pack: its title and state, then its tools at the
 * row's end — open it, move it earlier or later, take it out.
 */
export function ContentPackItemRow(
  props: ContentPackItemRowProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <MenuRow
      title={props.title}
      caption={
        <Show when={props.status} fallback={props.caption || undefined}>
          {(status) => (
            <ContentRowCaption description={props.caption}>
              <ContentStatusChip status={status()} />
            </ContentRowCaption>
          )}
        </Show>
      }
      trailing={
        <StackHorizontal gap="xs" align="center">
          <Show when={props.open}>
            {(open) => (
              <Button
                title={open() === 'edit' ? t`Edit` : t`View`}
                aria-label={
                  open() === 'edit'
                    ? t`Edit ${props.title}`
                    : t`View ${props.title}`
                }
                size="sm"
                intent="neutral"
                variant="ghost"
                onClick={() => props.onOpen()}
                dataSet={{ testid: 'content-pack-open' }}
              />
            )}
          </Show>
          <IconButton
            size={ROW_CONTROL}
            tooltip="none"
            label={t`Move ${props.title} up`}
            aria-label={t`Move ${props.title} up`}
            disabled={props.disabled || props.first}
            onClick={() => props.onUp()}
            dataSet={{ testid: 'content-pack-up' }}
          >
            <ChevronUpIcon size={20} color="icon" />
          </IconButton>
          <IconButton
            size={ROW_CONTROL}
            tooltip="none"
            label={t`Move ${props.title} down`}
            aria-label={t`Move ${props.title} down`}
            disabled={props.disabled || props.last}
            onClick={() => props.onDown()}
            dataSet={{ testid: 'content-pack-down' }}
          >
            <ChevronDownIcon size={20} color="icon" />
          </IconButton>
          <IconButton
            size={ROW_CONTROL}
            tooltip="none"
            label={t`Remove ${props.title} from pack`}
            aria-label={t`Remove ${props.title} from pack`}
            disabled={props.disabled}
            onClick={() => props.onRemove()}
            dataSet={{ testid: 'content-pack-remove' }}
          >
            <Trash2Icon size={20} color="icon" />
          </IconButton>
        </StackHorizontal>
      }
      dataSet={{ testid: `content-pack-item-${props.id}` }}
    />
  );
}

export type ContentPackEditorViewProps = {
  /** The working pack could be read; otherwise a kept copy is the way on. */
  readonly readable: boolean;
  /** How many puzzles the pack holds. */
  readonly count: number;
  /** One `ContentPackItemRow` per puzzle, in the pack's order. */
  readonly order: JSX.Element;
  readonly candidates: readonly ContentPackCandidate[];
  readonly addDisabled: boolean;
  readonly onAdd: (revisionId: string) => void;
  /** The game's board preview for a candidate's thumbnail. */
  readonly renderPreview?: ((definition: string) => JSX.Element) | undefined;
  /** A pack change saved, or why it was not, with its retry. */
  readonly notices?: JSX.Element;
  /** Making a new puzzle draft inside the pack, and opening it. */
  readonly create?: JSX.Element;
};

/** Published puzzles to add; nothing to list once the pack holds them all. */
function Candidates(props: ContentPackEditorViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.candidates.length > 0}>
      <MenuSection title={<Trans>Add a published puzzle</Trans>}>
        <For each={props.candidates.map((candidate) => candidate.id)}>
          {(id) => {
            const candidate = () =>
              props.candidates.find((entry) => entry.id === id);
            return (
              <MenuRow
                dataSet={{ testid: `content-add-puzzle-${id}` }}
                leading={
                  <ContentThumbnail
                    kind="puzzle"
                    size="md"
                    preview={candidate()?.preview}
                    renderPreview={props.renderPreview}
                  />
                }
                title={candidate()?.title}
                caption={candidate()?.caption || undefined}
                aria-label={t`Add ${candidate()?.title ?? ''} to the pack`}
                hideChevron
                trailing={<PlusIcon size={20} color="icon" />}
                disabled={props.addDisabled}
                onClick={() => props.onAdd(id)}
              />
            );
          }}
        </For>
      </MenuSection>
    </Show>
  );
}

/**
 * The pack builder's stage, presentational: the puzzles the pack holds,
 * in order, each with its tools; then published puzzles to add and a new
 * puzzle to create inside it. `ContentPackEditor` wires it to the working
 * pack.
 */
export function ContentPackEditorView(
  props: ContentPackEditorViewProps
): JSX.Element {
  return (
    <StackVertical gap="lg" dataSet={{ component: 'ContentPackEditor' }}>
      <Show
        when={props.readable}
        fallback={
          <Notice tone="error">
            <Trans>
              This pack cannot be read. Choose one of its draft copies to
              continue.
            </Trans>
          </Notice>
        }
      >
        <MenuSection
          title={<Trans>Puzzles in this pack</Trans>}
          dataSet={{ testid: 'content-pack-order' }}
          footer={
            <Trans>
              People may play them in any order. Publishing the pack keeps the
              edition of each puzzle it holds now.
            </Trans>
          }
        >
          <Show
            when={props.count > 0}
            fallback={
              <EmptyState
                variant="compact"
                title={<Trans>No puzzles yet</Trans>}
                body={
                  <Trans>
                    Add a published puzzle below, or create a new one.
                  </Trans>
                }
              />
            }
          >
            {props.order}
          </Show>
        </MenuSection>
      </Show>
      {props.notices}
      <Candidates {...props} />
      {props.create}
    </StackVertical>
  );
}
