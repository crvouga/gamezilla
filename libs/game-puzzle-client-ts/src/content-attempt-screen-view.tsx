import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ActionNotice } from '@pkgs/ui-root-client-ts/action-notice';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import {
  CircleCheckIcon,
  TriangleAlertIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Match, Show, Switch } from 'solid-js';
import {
  ContentAttemptProgressView,
  ContentAttemptSaveStatus,
} from './content-attempt-progress-view';
import type { ContentAttemptPlace } from './content-places';
import type { PuzzleContentFrame } from './puzzle-content-client';

/**
 * `loading`: the attempt asked for is still on its way; `gone`: no such
 * attempt here; `missing`: the attempt is kept but what it plays has not
 * reached this device; `ready`: the attempt on its board.
 */
export type ContentAttemptStatus = 'loading' | 'gone' | 'missing' | 'ready';

/** The saved attempt and what it plays, as the screen names them. */
export type ContentAttemptSummary = {
  readonly id: string;
  readonly sourceId: string;
  readonly packRevisionId: string | null;
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
};

/** Where the puzzle sits in the pack it is played from. */
export type ContentAttemptPack = {
  readonly title: string;
  /** The puzzle's place in the pack, from 1. */
  readonly position: number;
  readonly total: number;
};

/** One of the game's figures for the attempt: its label and value. */
export type AttemptFigure = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export type ContentAttemptScreenViewProps = {
  readonly status: ContentAttemptStatus;
  /** Set when the person may not change this attempt. */
  readonly denial?: DenialView | undefined;
  /** The small screen shown: the board, or where the attempt stands. */
  readonly place: ContentAttemptPlace;
  readonly onOpen: (place: ContentAttemptPlace) => void;
  readonly attempt: ContentAttemptSummary;
  /** The pack this attempt is played from; absent for a puzzle on its own. */
  readonly pack?: ContentAttemptPack | null | undefined;
  /** How many of the pack's puzzles are solved, this one included once saved. */
  readonly packSolved?: number | undefined;
  /** A private playtest of a draft: it counts toward no completion. */
  readonly playtest: boolean;
  /** The last change is still being saved. */
  readonly saving: boolean;
  /** Why the last change was not saved; the earlier position is kept. */
  readonly changeError: string | null;
  readonly complete: boolean;
  /**
   * A completion of this puzzle is already saved. Once the board is played
   * away from solved (a restart, an undo), the panel says so quietly
   * instead of repeating the full completion message.
   */
  readonly solvedBefore?: boolean | undefined;
  /** Published under rules this app version does not have. */
  readonly rulesChanged: boolean;
  /** The saved position cannot be projected onto the board. */
  readonly unopenable: boolean;
  /** The puzzle itself cannot be read, so restarting cannot help either. */
  readonly unreadable?: boolean | undefined;
  /** `attempt`: the game's player on the attempt's position. */
  readonly player?: JSX.Element;
  /** `attempt`: undo / redo and restart. */
  readonly controls?: JSX.Element;
  /**
   * `progress`: the attempt's way around — a pack puzzle's overview, a
   * playtest's way back to its builder.
   */
  readonly wayOn?: JSX.Element;
  /**
   * `attempt`, once solved: the one filled command onward, under the
   * solved headline — a pack's next puzzle, the finished pack, a
   * playtest's builder, or another puzzle.
   */
  readonly onward?: JSX.Element;
  /** Where the board sits on a one-column screen. */
  readonly stageAlign?: 'start' | 'center' | undefined;
  /** `progress`: earlier kept continuations to choose from. */
  readonly keptPositions?: JSX.Element;
  /**
   * The game's own figures for where the attempt stands, by its labels
   * (`Connected pairs 2`, `Moves 12`); empty when it gives none.
   */
  readonly figures?: readonly AttemptFigure[] | undefined;
  readonly figuresPlacement?: PuzzleContentFrame['figuresPlacement'];
  /** The attempt's confirmation dialogs, kept whichever place is shown. */
  readonly confirms?: JSX.Element;
  readonly onRetryChange: () => void;
  readonly onReturnToLibrary: () => void;
  /** Restarts into a new attempt: offered where no board can show. */
  readonly onRestart?: (() => void) | undefined;
  /** A refused command's reason with its retry (a restart), on both places. */
  readonly notice?: JSX.Element;
  /** Loads the newest version of the app, for rules this one lacks. */
  readonly onUpdateApp?: (() => void) | undefined;
};

/**
 * What stops play or needs the person first, on every place: rules this
 * app lacks, or a change that was not saved.
 */
function AttemptAlerts(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show when={props.rulesChanged}>
        <ActionNotice
          icon={TriangleAlertIcon}
          title={t`This puzzle needs a newer version of the app`}
          body={t`Your saved attempt stays kept. Update the app to continue it.`}
          action={
            props.onUpdateApp === undefined
              ? undefined
              : {
                  label: t`Update the app`,
                  onClick: () => props.onUpdateApp?.(),
                }
          }
          dataSet={{ testid: 'content-attempt-rules-changed' }}
        />
      </Show>
      {props.notice}
      <Show when={props.changeError}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your last move is not saved`}
            body={error()}
            retry={{ onClick: props.onRetryChange }}
          />
        )}
      </Show>
    </>
  );
}

/**
 * What the puzzle asks ("Join each pair of numbers and fill every
 * square."), right above the board it is played on, at every size.
 */
function AttemptRule(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <Show when={props.attempt.description}>
      <P tone="secondary" testId="puzzle-attempt-rule">
        {props.attempt.description}
      </P>
    </Show>
  );
}

/**
 * The stage's quiet way to where the attempt stands: its pack, its
 * figures and the positions kept for it.
 */
function OpenProgress(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Details`}
      intent="neutral"
      variant="outline"
      size="sm"
      onClick={() => props.onOpen({ screen: 'progress' })}
      dataSet={{
        testid: 'content-open-progress',
        complete: String(props.complete),
      }}
    />
  );
}

/** Where the attempt sits, under its title: its place in its pack, or a playtest. */
function useAttemptContext(
  props: ContentAttemptScreenViewProps
): () => string | undefined {
  const { t } = useLingui();
  return () => {
    if (props.playtest)
      return t`Playtest of your draft · counts toward no progress`;
    const pack = props.pack;
    if (pack === null || pack === undefined) return undefined;
    return t`Puzzle ${pack.position} of ${pack.total} · ${pack.title}`;
  };
}

/** Where the solved puzzle leaves the person, in one line under its headline. */
function useSolvedCaption(props: ContentAttemptScreenViewProps): () => string {
  const { t } = useLingui();
  return () => {
    if (props.playtest) return t`Return to the builder to publish it.`;
    const pack = props.pack;
    if (pack !== null && pack !== undefined && props.packSolved !== undefined)
      return props.packSolved >= pack.total
        ? t`Pack complete: every puzzle in ${pack.title} is solved.`
        : t`${props.packSolved} of ${pack.total} solved in ${pack.title}.`;
    return t`Restart to play it again, or choose another puzzle.`;
  };
}

/**
 * The solved headline beside the board's commands, never over the board:
 * the completion is saved (or a playtest solved), where the pack now
 * stands, and the one filled command onward. It takes the save line's
 * place, so the save is said once.
 */
function AttemptSolved(
  props: ContentAttemptScreenViewProps & {
    /** The headline also says the save (where it replaces the save line). */
    withSave: boolean;
  }
): JSX.Element {
  const { t } = useLingui();
  const caption = useSolvedCaption(props);
  return (
    <StackVertical gap="sm" dataSet={{ testid: 'content-attempt-solved' }}>
      {/* One line, so the board keeps its room: the record, where the
          pack stands, and the save. */}
      <StackHorizontal
        gap="sm"
        align="start"
        dataSet={{ testid: 'content-attempt-complete' }}
      >
        <CircleCheckIcon size={20} color="success" />
        <StackVertical gap="xs" grow shrink>
          <Text variant="label" tone="success">
            {props.playtest
              ? t`Playtest solved`
              : props.saving
                ? t`Solved`
                : t`Completion saved`}
          </Text>
          <P variant="caption" tone="secondary">
            {caption()}{' '}
            <Show when={props.withSave}>
              <Text
                variant="inherit"
                role="status"
                testId="content-position-save-status"
              >
                {props.saving
                  ? t`Saving your position…`
                  : t`Progress saved on this device.`}
              </Text>
            </Show>
          </P>
        </StackVertical>
      </StackHorizontal>
      {props.onward}
    </StackVertical>
  );
}

/**
 * Wide screens only, in the rail beside the board under its commands: once
 * solved, the solved headline and the way on (under the commands, so they
 * never move); then where the puzzle sits — its pack and how much of it is
 * solved, or that it stands on its own.
 */
function AttemptAside(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  return (
    <Show when={mode() === 'wide'}>
      <Show
        when={!(props.complete && !props.unopenable)}
        fallback={<AttemptSolved {...props} withSave={false} />}
      >
        <GameSection
          title={
            <Show when={props.pack} fallback={<Trans>This puzzle</Trans>}>
              {(pack) => pack().title}
            </Show>
          }
          dataSet={{ testid: 'puzzle-attempt-aside' }}
        >
          <Show
            when={props.pack}
            fallback={
              <P variant="caption" tone="secondary">
                {props.playtest
                  ? t`A practice run of your draft. It counts toward no progress.`
                  : t`A puzzle on its own. Your moves are kept as you play.`}
              </P>
            }
          >
            {(pack) => (
              <StackVertical gap="sm">
                <P variant="caption" tone="secondary">
                  {t`${props.packSolved ?? 0} of ${pack().total} solved`}
                </P>
                <ProgressBar
                  size="sm"
                  progress={(props.packSolved ?? 0) / Math.max(1, pack().total)}
                  accessibleLabel={t`${props.packSolved ?? 0} of ${pack().total} solved`}
                />
              </StackVertical>
            )}
          </Show>
        </GameSection>
      </Show>
    </Show>
  );
}

/**
 * Under the board: the save line; on a phone, once solved, the solved
 * headline in its place, over the commands held at the screen's foot.
 */
function AttemptStatus(props: ContentAttemptScreenViewProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show
      when={props.complete && !props.unopenable && mode() === 'compact'}
      fallback={
        <Show when={props.changeError === null && boardShown(props)}>
          <ContentAttemptSaveStatus {...props} />
        </Show>
      }
    >
      <AttemptSolved {...props} withSave />
    </Show>
  );
}

/** Why there is no board to play: the position, or the puzzle itself. */
function Unopenable(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    // Room around the actions so their focus rings are never clipped.
    <StackVertical gap="md" paddingY="xs">
      <Notice tone="error">
        <Show
          when={props.unreadable === true}
          fallback={
            <Trans>
              This saved position cannot be opened. Continue from another saved
              position, or restart. Your earlier attempt stays saved.
            </Trans>
          }
        >
          <Trans>
            This puzzle cannot be opened. Your attempt stays saved. Return to
            the puzzles to choose another.
          </Trans>
        </Show>
      </Notice>
      <Show
        when={props.unreadable === true}
        fallback={
          <StackVertical gap="sm">
            <Button
              title={t`Choose another saved position`}
              fullWidth
              onClick={() => props.onOpen({ screen: 'progress' })}
              dataSet={{ testid: 'content-unopenable-positions' }}
            />
            <Show when={props.onRestart}>
              {(restart) => (
                <Button
                  title={t`Restart from the beginning`}
                  intent="neutral"
                  variant="outline"
                  fullWidth
                  onClick={() => restart()()}
                  dataSet={{ testid: 'content-unopenable-restart' }}
                />
              )}
            </Show>
          </StackVertical>
        }
      >
        <Button
          title={t`Back to puzzles`}
          fullWidth
          onClick={() => props.onReturnToLibrary()}
          dataSet={{ testid: 'content-unreadable-library' }}
        />
      </Show>
    </StackVertical>
  );
}

/** A board the person can play is on screen (not unopenable, not under rules this app lacks). */
function boardShown(props: ContentAttemptScreenViewProps): boolean {
  return !props.unopenable && !props.rulesChanged;
}

/** The identifiers every place of one attempt carries. */
function attemptDataSet(props: ContentAttemptScreenViewProps) {
  return {
    testid: 'content-attempt',
    attemptid: props.attempt.id,
    sourceid: props.attempt.sourceId,
    packrevisionid: props.attempt.packRevisionId ?? '',
    place: props.place.screen,
  };
}

/**
 * `attempt`: the stage. The puzzle's title and difficulty, what it asks,
 * the game's player on the saved position, one status line (the save), and
 * with the board its own commands (undo, redo, restart) and the one
 * control onward.
 */
function AttemptStage(props: ContentAttemptScreenViewProps): JSX.Element {
  const context = useAttemptContext(props);
  return (
    <GameScreen
      screenId="puzzle-content-attempt"
      dataSet={attemptDataSet(props)}
      title={props.attempt.title}
      subtitle={context()}
      keepTitle
      facts={
        <Show when={props.attempt.difficulty}>
          {(difficulty) => <Badge intent="neutral" label={difficulty()} />}
        </Show>
      }
    >
      <GameSessionLayout
        notices={
          <>
            <AttemptRule {...props} />
            <AttemptAlerts {...props} />
          </>
        }
        status={<AttemptStatus {...props} />}
        actions={
          <>
            {/* With no board, the body offers what can help instead. */}
            <Show when={boardShown(props)}>{props.controls}</Show>
            <OpenProgress {...props} />
          </>
        }
        aside={<AttemptAside {...props} />}
        actionsBeside
        fixedStage
        stageFit="compact"
        stageAlign={props.stageAlign}
      >
        {/* The stage narrows the game's board to the room a phone's fixed
            view leaves over the commands, so none of it hides. */}
        <GameBoardStage inset>
          <Show when={!props.unopenable} fallback={<Unopenable {...props} />}>
            {/* Under rules this app lacks the board cannot be played: the
                notice above and its Update the app are what helps. */}
            <Show when={!props.rulesChanged}>{props.player}</Show>
          </Show>
        </GameBoardStage>
      </GameSessionLayout>
    </GameScreen>
  );
}

/** `progress` under the attempt's title, with what needs the person first. */
function AttemptProgress(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <EmbeddedScreen
      screenId="puzzle-content-attempt-progress"
      dataSet={attemptDataSet(props)}
      title={props.attempt.title}
      subtitle={t`Where this attempt stands`}
    >
      <AttemptAlerts {...props} />
      <ContentAttemptProgressView view={props} />
    </EmbeddedScreen>
  );
}

/** The attempt cannot be shown: why, and the way back to the puzzles. */
function AttemptUnavailable(props: {
  gone: boolean;
  onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <ErrorState
      title={
        props.gone
          ? t`This attempt is no longer here`
          : t`This puzzle has not reached this device`
      }
      body={
        props.gone
          ? t`It was removed, or it belongs to another account. Return to puzzles to continue another.`
          : t`Return to puzzles, reconnect and open the attempt again. Your progress stays saved.`
      }
      secondary={{
        label: t`Return to puzzles`,
        onClick: () => props.onReturnToLibrary(),
      }}
    />
  );
}

/**
 * A saved attempt at a published puzzle or a private playtest,
 * presentational, as two small screens. `attempt` is the stage: the
 * puzzle's title and difficulty, what it asks, the game's player on the
 * saved position, the save status as its one status line, undo, redo and
 * restart, and one control onward. `progress` is where the attempt stands:
 * its place in its pack and the next puzzle, the game's figures, the save
 * status, the completion, and the kept positions. A change that was not
 * saved and rules this app lacks are said on both — or loading, denied,
 * gone and not-on-this-device states. Player, commands and dialogs arrive as slots.
 */
export function ContentAttemptScreenView(
  props: ContentAttemptScreenViewProps
): JSX.Element {
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.denial}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Match>
      <Match when={props.status === 'ready'}>
        <Switch>
          <Match when={props.place.screen === 'attempt'}>
            <AttemptStage {...props} />
          </Match>
          <Match when={props.place.screen === 'progress'}>
            <AttemptProgress {...props} />
          </Match>
        </Switch>
        {props.confirms}
      </Match>
      <Match when={props.status === 'gone' || props.status === 'missing'}>
        <AttemptUnavailable
          gone={props.status === 'gone'}
          onReturnToLibrary={props.onReturnToLibrary}
        />
      </Match>
    </Switch>
  );
}
