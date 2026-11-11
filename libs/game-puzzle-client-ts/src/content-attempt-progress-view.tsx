import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type {
  ContentAttemptPack,
  ContentAttemptScreenViewProps,
} from './content-attempt-screen-view';

/** Where the attempt stands in the game's own figures, under the pack's bar. */
function AttemptFigures(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={
        props.figuresPlacement !== 'board' && (props.figures?.length ?? 0) > 0
      }
    >
      <MetricStrip
        aria-label={t`This attempt`}
        dataSet={{ testid: 'puzzle-attempt-figures' }}
        metrics={(props.figures ?? []).map((figure) => ({
          label: figure.label,
          value: figure.value,
        }))}
      />
    </Show>
  );
}

/** A solved attempt (not a playtest) whose last change is kept. */
function completionSaved(props: ContentAttemptScreenViewProps): boolean {
  return props.complete && props.playtest !== true && !props.saving;
}

/** Where the last change stands: saved, or still being saved. */
export function ContentAttemptSaveStatus(
  props: ContentAttemptScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <P
      role="status"
      variant="caption"
      tone="secondary"
      dataSet={{ testid: 'content-position-save-status' }}
    >
      {props.saving
        ? t`Saving your position…`
        : t`Progress saved on this device.`}
    </P>
  );
}

/** `Puzzle 3 of 4 in Warehouse basics`, for a puzzle played from a pack. */
function PackPlace(props: { pack: ContentAttemptPack }): JSX.Element {
  return (
    <Text variant="inherit" testId="puzzle-attempt-pack-place">
      <Trans>
        Puzzle {props.pack.position} of {props.pack.total} in {props.pack.title}
      </Trans>
    </Text>
  );
}

/** How far through its pack this puzzle is, as a bar under its place. */
function PackTrack(props: { pack: ContentAttemptPack }): JSX.Element {
  const { t } = useLingui();
  return (
    <ProgressBar
      size="sm"
      progress={props.pack.position / Math.max(1, props.pack.total)}
      accessibleLabel={t`Puzzle ${props.pack.position} of ${props.pack.total}`}
      dataSet={{ testid: 'puzzle-attempt-pack-track' }}
    />
  );
}

/**
 * The puzzle panel, what is useful first: its heading says where the
 * puzzle sits in its pack ("Puzzle 3 of 4 in Warehouse basics", or "This
 * puzzle" on its own) over a bar of how far through the pack it is and the
 * pack's way on, then the game's own figures for the attempt, the save
 * status in one short quiet line, a playtest's note and the completion.
 */
function AttemptPanel(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <GameSection
      title={
        <Show when={props.pack} fallback={<Trans>This puzzle</Trans>}>
          {(pack) => <PackPlace pack={pack()} />}
        </Show>
      }
      dataSet={{ testid: 'puzzle-attempt-panel' }}
    >
      <Show when={props.pack}>{(pack) => <PackTrack pack={pack()} />}</Show>
      <Show when={(props.pack ?? null) !== null || props.playtest}>
        <StackHorizontal
          gap="sm"
          wrap
          dataSet={{ testid: 'puzzle-attempt-pack-actions' }}
        >
          {props.wayOn}
        </StackHorizontal>
      </Show>
      <AttemptFigures {...props} />
      {/* A saved completion carries the save line in its own notice. */}
      <Show when={!completionSaved(props)}>
        <ContentAttemptSaveStatus {...props} />
      </Show>
      <Show when={props.playtest}>
        <Notice>
          <Trans>
            Playtest: this uses the real puzzle rules. It does not count toward
            personal or pack completion.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.complete}>
        <SuccessState
          variant="compact"
          dataSet={{ testid: 'content-attempt-complete' }}
          title={props.playtest ? t`Playtest solved` : t`Completion saved`}
          body={
            completionSaved(props) ? (
              <>
                <Text
                  variant="inherit"
                  role="status"
                  testId="content-position-save-status"
                >
                  {t`Progress saved on this device.`}
                </Text>{' '}
                {t`You can keep playing or choose another puzzle.`}
              </>
            ) : props.playtest ? (
              t`Return to the builder to validate and publish this puzzle.`
            ) : (
              t`Your completion is saved. You can keep playing or choose another puzzle.`
            )
          }
        />
      </Show>
      <Show
        when={!props.complete && !props.playtest && props.solvedBefore === true}
      >
        <P
          variant="caption"
          tone="secondary"
          testId="content-attempt-solved-before"
        >
          {t`Solved before. Your completion stays saved.`}
        </P>
      </Show>
    </GameSection>
  );
}

/**
 * `progress`: where the attempt stands (its place in its pack and the way
 * on, the game's figures, the save status, the completion), then the
 * earlier positions kept for it, and the way back to the board.
 */
export function ContentAttemptProgressView(props: {
  view: ContentAttemptScreenViewProps;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-attempt-progress' }}>
      <AttemptPanel {...props.view} />
      {props.view.keptPositions}
      <Button
        title={t`Back to the board`}
        intent="neutral"
        variant="outline"
        fullWidth
        onClick={() => props.view.onOpen({ screen: 'attempt' })}
        dataSet={{ testid: 'content-return-board' }}
      />
    </StackVertical>
  );
}
