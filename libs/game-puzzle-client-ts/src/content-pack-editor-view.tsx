import { Trans, useLingui } from '@lingui/solid/macro';
import { EditorWorkbench } from '@pkgs/ui-root-client-ts/editor-workbench';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EllipsisIcon,
  PlusIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { ContentStatusChip } from './content-chips';
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

/** The quiet disc at the row's end: small, its hit area still 44px. */
const MENU_DISC_SIZE = 32;
/** Wide enough for its three rows, not a panel. */
const MENU_WIDTH = 220;

/** The row's "…" menu: move it earlier or later, take it out. */
function PackRowMenu(props: ContentPackItemRowProps): JSX.Element {
  const { t } = useLingui();
  return (
    <OverflowMenuButton
      aria-label={t`More for ${props.title}`}
      icon={EllipsisIcon}
      size={MENU_DISC_SIZE}
      width={MENU_WIDTH}
      actions={[
        {
          id: 'up',
          label: t`Move up`,
          icon: ChevronUpIcon,
          disabled: props.disabled || props.first,
          onClick: () => props.onUp(),
          dataSet: { testid: 'content-pack-up' },
        },
        {
          id: 'down',
          label: t`Move down`,
          icon: ChevronDownIcon,
          disabled: props.disabled || props.last,
          onClick: () => props.onDown(),
          endsGroup: true,
          dataSet: { testid: 'content-pack-down' },
        },
        {
          id: 'remove',
          label: t`Remove from pack`,
          icon: Trash2Icon,
          tone: 'destructive',
          disabled: props.disabled,
          onClick: () => props.onRemove(),
          dataSet: { testid: 'content-pack-remove' },
        },
      ]}
      dataSet={{ testid: 'content-pack-menu' }}
    />
  );
}

/**
 * One puzzle in the pack: the whole row opens it (to edit, or its
 * published edition), its title over what the author still has to do
 * with it, its status chip at the row's end, and beside the row a "…"
 * menu holding the rest: move it earlier or later, take it out.
 */
export function ContentPackItemRow(
  props: ContentPackItemRowProps
): JSX.Element {
  return (
    <MenuRow
      title={props.title}
      caption={props.caption || undefined}
      trailing={
        <Show when={props.status}>
          {(status) => (
            // Centred on the row like its menu, on two lines as on one.
            <StackHorizontal align="center">
              <ContentStatusChip status={status()} />
            </StackHorizontal>
          )}
        </Show>
      }
      accessory={<PackRowMenu {...props} />}
      onClick={props.open === null ? undefined : () => props.onOpen()}
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
 * puzzle to create inside it. Where there is room the pack's list takes a
 * board's measure and the ways to add sit beside it, so each row's tools
 * stay near its title; narrower, they follow the list. `ContentPackEditor`
 * wires it to the working pack.
 */
export function ContentPackEditorView(
  props: ContentPackEditorViewProps
): JSX.Element {
  return (
    <EditorWorkbench
      narrowOrder="canvas-first"
      dataSet={{ component: 'ContentPackEditor' }}
      canvas={<PackOrder {...props} />}
      tools={
        <StackVertical gap="lg">
          <Candidates {...props} />
          {props.create}
        </StackVertical>
      }
      notes={props.notices}
    />
  );
}

/** The puzzles the pack holds, in order, or why they cannot be read. */
function PackOrder(props: ContentPackEditorViewProps): JSX.Element {
  return (
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
  );
}
