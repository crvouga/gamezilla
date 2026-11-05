import type {
  ContentBody,
  ContentKind,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { DisclosureCard } from '@pkgs/ui-root-client-ts/disclosure-card';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { ChevronDownIcon, EyeIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import {
  createScrollTarget,
  type ScrollHandle,
  type ScrollTarget,
} from '@pkgs/ui-root-client-ts/scroll';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { StepFooter } from '@pkgs/ui-root-client-ts/step-footer';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ContentDraftMetadata } from './content-draft-metadata';
import type { PublicationStep } from './content-publication-steps';

/**
 * `loading`: the library is still being read; `gone`: the document is not
 * (or no longer) in it; `missing`: its working copy has not reached this
 * device; `ready`: the builder.
 */
export type ContentAuthorStatus = 'loading' | 'gone' | 'missing' | 'ready';

/** Where the working copy's last save stands. */
export type ContentDraftSave = {
  readonly saving: boolean;
  /** Edits that still need to be saved. */
  readonly dirty: boolean;
  /** Why the last save failed; the edits stay on screen. */
  readonly error: string | null;
};

export type ContentAuthorScreenViewProps = {
  readonly status: ContentAuthorStatus;
  /** Set when the person may not edit this document. */
  readonly denial?: DenialView | undefined;
  readonly documentId: string;
  readonly kind: ContentKind;
  /** The working copy's title, description, difficulty and definition. */
  readonly body: ContentBody;
  readonly save: ContentDraftSave;
  /** Another working copy was kept meanwhile: choose one before publishing. */
  readonly conflicted: boolean;
  readonly metadataDisabled: boolean;
  /** The builder is busy (saving, adopting a copy, a pack change). */
  readonly disabled: boolean;
  /** Previewing the draft as a player sees it. */
  readonly preview: boolean;
  /** Undo / redo of this session's edits. */
  readonly history?: JSX.Element;
  /**
   * Validation and publication, laid out for the publish footer (a
   * puzzle's playtest first among its actions).
   */
  readonly publication?: JSX.Element;
  /**
   * The one next step on the way to publishing; on a phone, where the
   * publish step starts below the board, a quiet button near the top names
   * it and takes the person there.
   */
  readonly nextStep?: PublicationStep | undefined;
  /** The game's editor, the pack editor, or the preview. */
  readonly stage?: JSX.Element;
  /** The draft's other saved copies, to keep working from one. */
  readonly keptCopies?: JSX.Element;
  readonly onChangeBody: (body: ContentBody) => void;
  readonly onSaveAgain: () => void;
  readonly onTogglePreview: () => void;
  readonly onReturnToLibrary: () => void;
};

/**
 * Where the working copy's last save stands, one quiet line after the
 * builder's kind under its title.
 */
function SaveLine(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Text variant="inherit" role="status" testId="content-draft-save-status">
      {props.save.saving
        ? t`Saving your draft…`
        : props.save.dirty
          ? t`Your changes still need to be saved.`
          : t`Saved on this device. Changes share when connected.`}
    </Text>
  );
}

/** A failed save or a conflicting copy: what needs the author first. */
function SaveNotices(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show when={props.save.error}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your changes are still here`}
            body={error()}
            retry={{ label: t`Save again`, onClick: props.onSaveAgain }}
          />
        )}
      </Show>
      <Show when={props.conflicted}>
        <Notice tone="warning">
          <Trans>
            Another device saved a different copy of this draft. Choose the copy
            to keep working from under Draft copies before publishing.
          </Trans>
        </Notice>
      </Show>
    </>
  );
}

/**
 * The editing tools, heading the stage they act on: the step's name at the
 * start, then undo and redo of this session's edits and a look at the
 * draft as a player sees it at the end of the same line.
 */
function AuthorTools(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal
      gap="sm"
      wrap
      align="center"
      justify="between"
      dataSet={{ testid: 'content-author-tools' }}
    >
      <H2 size="navigationTitle" testId="content-author-stage-step">
        {props.kind === 'pack' ? t`2 · Puzzles` : t`2 · Board`}
      </H2>
      <StackHorizontal gap="xs" wrap align="center">
        {props.history}
        <Button
          title={props.preview ? t`Return to editing` : t`Preview`}
          intent="neutral"
          variant="ghost"
          size="sm"
          startIcon={<EyeIcon size={16} />}
          onClick={() => props.onTogglePreview()}
          disabled={props.disabled}
          dataSet={{ testid: 'content-preview' }}
        />
      </StackHorizontal>
    </StackHorizontal>
  );
}

/** What the closed details say: the difficulty, then the description. */
function detailsSummary(body: ContentBody): string {
  return [body.difficulty.trim(), body.description.trim()]
    .filter((part) => part !== '')
    .join(' · ');
}

/**
 * Step one: the draft's title, description and difficulty, closed to one
 * row over the stage once the draft has a title, so the board or the
 * pack's puzzles fill the screen; a new draft opens on them.
 */
function AuthorDetails(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <DisclosureCard
      title={t`1 · Details`}
      summary={
        detailsSummary(props.body) || t`Title, description and difficulty`
      }
      defaultOpen={props.body.title.trim() === ''}
      toggleTestId="content-author-details-toggle"
      dataSet={{ testid: 'content-author-details' }}
    >
      <ContentDraftMetadata
        body={props.body}
        disabled={props.metadataDisabled}
        onChange={props.onChangeBody}
      />
    </DisclosureCard>
  );
}

/**
 * On a phone the publish step starts below the board: near the top, one
 * quiet button names the next step and scrolls to it. It sits in the flow,
 * so it never covers the board, and wide screens, where the publish step
 * is in view beside the stage's end, go without it.
 */
function NextStepJump(props: {
  next: PublicationStep | undefined;
  publish: ScrollHandle;
}): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  const title = (step: PublicationStep): string => {
    if (step === 'puzzles') return t`Next: publish its puzzles`;
    if (step === 'playtest') return t`Next: start a playtest`;
    return step === 'publish' ? t`Next: publish` : t`Next: validate`;
  };
  return (
    <Show when={mode() === 'compact' ? props.next : undefined}>
      {(step) => (
        <StackHorizontal>
          <Button
            title={title(step())}
            intent="neutral"
            variant="ghost"
            size="sm"
            startIcon={<ChevronDownIcon size={16} />}
            onClick={() => {
              props.publish.scrollIntoView({ block: 'start' });
            }}
            dataSet={{ testid: 'content-author-next-step', step: step() }}
          />
        </StackHorizontal>
      )}
    </Show>
  );
}

/**
 * The last step, in the flow right after the stage: where the draft
 * stands, a puzzle's playtest, then the check and publication. It scrolls
 * with the stage instead of being pinned over it, so it never covers the
 * board or the pack's puzzles.
 */
function AuthorPublish(
  props: ContentAuthorScreenViewProps & { target: ScrollTarget }
): JSX.Element {
  const { t } = useLingui();
  return (
    <StepFooter
      title={t`3 · Check and publish`}
      scrollTarget={props.target}
      dataSet={{ testid: 'content-author-publish' }}
    >
      {props.publication}
    </StepFooter>
  );
}

/**
 * One builder in three numbered steps, read top to bottom at every size:
 * the details (one row once titled), the stage with its tools across the
 * whole column (a game's editor sets its own tools beside its board), and
 * checking and publishing right after the stage; the draft's other saved
 * copies, no step of their own, come last.
 */
function AuthorBody(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const publish = createScrollTarget();
  return (
    <GameScreen
      screenId="puzzle-content-author"
      dataSet={{ testid: 'content-author', documentid: props.documentId }}
      title={
        <Text variant="inherit" testId="content-author-title">
          {props.body.title || t`Untitled draft`}
        </Text>
      }
      subtitle={
        <>
          {props.kind === 'pack' ? t`Pack builder` : t`Puzzle builder`}
          {' · '}
          <SaveLine {...props} />
        </>
      }
    >
      <GameSessionLayout
        notices={
          <>
            <SaveNotices {...props} />
            <AuthorDetails {...props} />
            <NextStepJump next={props.nextStep} publish={publish} />
          </>
        }
        workspace
      >
        <StackVertical gap="xl">
          <StackVertical gap="md" dataSet={{ testid: 'content-author-stage' }}>
            <AuthorTools {...props} />
            {props.stage}
          </StackVertical>
          <AuthorPublish {...props} target={publish.target} />
          {props.keptCopies}
        </StackVertical>
      </GameSessionLayout>
    </GameScreen>
  );
}

/**
 * The puzzle or pack builder, presentational, one layout for both, in
 * three numbered steps: the draft's details; the stage (the game's editor,
 * the pack's puzzles, or a preview) headed by its editing tools; and
 * checking and publishing it, then the draft's other saved copies — or
 * loading, denied and not-on-this-device states. The
 * host's bar holds the way back to the puzzles. Smart widgets arrive as
 * slots.
 */
export function ContentAuthorScreenView(
  props: ContentAuthorScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.denial}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Match>
      <Match when={props.status === 'missing'}>
        <ErrorState
          title={t`This draft is not available on this device`}
          body={t`Return to your library, reconnect and open it again. Your saved work stays kept.`}
          secondary={{
            label: t`Return to puzzles`,
            onClick: () => props.onReturnToLibrary(),
          }}
        />
      </Match>
      <Match when={props.status === 'ready'}>
        <AuthorBody {...props} />
      </Match>
    </Switch>
  );
}
