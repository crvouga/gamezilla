import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { For, type JSX, Show } from 'solid-js';
import { ContentProgressLine } from './content-library-card';
import type { ContentLibraryScreenViewProps } from './content-library-screen-view';
import { ContentThumbnail } from './content-thumbnail';

type View = ContentLibraryScreenViewProps;

/** A draft is being made: every other row waits for it. */
function creating(view: View): boolean {
  return view.create.status === 'creating';
}

/** How much a list holds: its loaded count, with `+` while more can load. */
function useCount(): (count: number, more: boolean) => string {
  const { t } = useLingui();
  return (count, more) => {
    if (count === 0 && !more) return t`None yet`;
    return more ? t`${count}+` : String(count);
  };
}

/** What to play: where the person left off, what they solved, everything published. */
function PlayRows(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const count = useCount();
  const done = (completed: boolean): number =>
    props.view.attempts.filter((attempt) => attempt.completed === completed)
      .length;
  return (
    <MenuSection title={<Trans>Play</Trans>}>
      <MenuRow
        title={t`Continue`}
        caption={t`Puzzles you started`}
        value={count(done(false), props.view.more.attempts)}
        disabled={creating(props.view)}
        onClick={() => props.view.onOpen({ screen: 'continue' })}
        dataSet={{ testid: 'content-library-tab-continue' }}
      />
      <Show when={done(true) > 0 || props.view.more.attempts}>
        <MenuRow
          title={t`Solved`}
          caption={t`Puzzles you finished`}
          value={count(done(true), props.view.more.attempts)}
          disabled={creating(props.view)}
          onClick={() => props.view.onOpen({ screen: 'solved' })}
          dataSet={{ testid: 'content-library-tab-solved' }}
        />
      </Show>
      <MenuRow
        title={t`Browse`}
        caption={t`Published puzzles and packs`}
        value={count(props.view.published.length, props.view.more.published)}
        disabled={creating(props.view)}
        onClick={() => props.view.onOpen({ screen: 'browse' })}
        dataSet={{ testid: 'content-library-tab-browse' }}
      />
    </MenuSection>
  );
}

/** Packs the game ships: available to everyone, with or without a connection. */
function StarterPacks(props: { view: View }): JSX.Element {
  return (
    <Show when={props.view.bundledPacks.length > 0}>
      <MenuSection title={<Trans>Starter packs</Trans>}>
        <For each={props.view.bundledPacks}>
          {(pack) => (
            <MenuRow
              leading={
                <ContentThumbnail
                  kind={pack.kind}
                  size="md"
                  preview={pack.preview}
                  renderPreview={props.view.renderPreview}
                />
              }
              title={pack.title}
              caption={pack.description || undefined}
              value={
                pack.progress === undefined ||
                pack.progress.total === 0 ? undefined : (
                  <ContentProgressLine progress={pack.progress} />
                )
              }
              disabled={creating(props.view)}
              onClick={() => props.view.onOpenEdition(pack.id)}
              dataSet={{ testid: `content-bundled-${pack.document_id}` }}
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}

/** One "create a draft" row: a spinner while it is the one being made. */
function CreateRow(props: { view: View; kind: ContentKind }): JSX.Element {
  const { t } = useLingui();
  const mine = () =>
    props.view.create.status === 'creating' &&
    props.view.create.kind === props.kind;
  return (
    <MenuRow
      title={props.kind === 'pack' ? t`Create pack` : t`Create puzzle`}
      caption={
        props.kind === 'pack'
          ? t`A private draft of puzzles to play in a row`
          : t`A private draft on an empty board`
      }
      hideChevron
      trailing={
        <Show when={mine()} fallback={<PlusIcon size={20} color="icon" />}>
          <Spinner size="sm" label={t`Creating…`} />
        </Show>
      }
      disabled={creating(props.view)}
      onClick={() => props.view.onCreate(props.kind)}
      dataSet={{
        testid:
          props.kind === 'pack'
            ? 'content-create-pack'
            : 'content-create-puzzle',
      }}
    />
  );
}

/** The draft just made, waiting to be opened. */
function CreatedRow(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const created = () =>
    props.view.create.status === 'created' ? props.view.create : undefined;
  return (
    <Show when={created()}>
      {(draft) => (
        <MenuRow
          title={t`Open created draft`}
          value={
            draft().kind === 'pack' ? t`Untitled pack` : t`Untitled puzzle`
          }
          onClick={() => props.view.onOpenDraft(draft().documentId)}
          dataSet={{ testid: 'content-open-created-draft' }}
        />
      )}
    </Show>
  );
}

/** What the person builds: their drafts, their playtests, and making more. */
function MakeRows(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const count = useCount();
  return (
    <MenuSection
      title={<Trans>Make your own</Trans>}
      footer={<Trans>Drafts stay private until you publish them.</Trans>}
    >
      <MenuRow
        title={t`My creations`}
        caption={t`Your drafts and publications`}
        value={
          props.view.personalDenial === undefined
            ? count(props.view.drafts.length, props.view.more.owned)
            : undefined
        }
        disabled={creating(props.view)}
        onClick={() => props.view.onOpen({ screen: 'mine' })}
        dataSet={{ testid: 'content-library-tab-mine' }}
      />
      <Show when={props.view.playtests.length > 0}>
        <MenuRow
          title={t`Playtests`}
          caption={t`Practice runs of your drafts`}
          value={String(props.view.playtests.length)}
          disabled={creating(props.view)}
          onClick={() => props.view.onOpen({ screen: 'playtests' })}
          dataSet={{ testid: 'content-library-tab-playtests' }}
        />
      </Show>
      <Show when={props.view.createDenial === undefined}>
        <Show when={props.view.canCreatePuzzle}>
          <CreateRow view={props.view} kind="puzzle" />
        </Show>
        <CreateRow view={props.view} kind="pack" />
        <CreatedRow view={props.view} />
      </Show>
    </MenuSection>
  );
}

/**
 * The library's hub: rows that lead onward, each with how much it holds
 * (Continue, Solved, Browse), the shipped starter packs, then what the
 * person makes: their creations, their playtests, and a row each to create
 * a puzzle or a pack (or why they may not).
 */
export function ContentLibraryHubView(props: { view: View }): JSX.Element {
  return (
    <>
      <PlayRows view={props.view} />
      <StarterPacks view={props.view} />
      <MakeRows view={props.view} />
      <Show when={props.view.createDenial}>
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </>
  );
}
