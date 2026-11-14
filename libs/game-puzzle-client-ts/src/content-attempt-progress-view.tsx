import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { MetricStrip } from '@pkgs/ui-root-client-ts/metric-strip';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
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
        props.figuresPlacement !== 'board' &&
        !props.complete &&
        (props.figures?.length ?? 0) > 0
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
        : props.changeError !== null
          ? t`Your last move is not saved yet. The position before it is kept.`
          : props.complete &&
              !props.playtest &&
              props.place.screen === 'progress'
            ? t`Solved. Progress saved on this device.`
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

/**
 * How much of the pack is solved, as a labelled bar under the puzzle's
 * place; where the count is not known, how far through the pack it sits.
 */
function PackTrack(props: {
  pack: ContentAttemptPack;
  solved: number | undefined;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.solved !== undefined}
      fallback={
        <ProgressBar
          size="sm"
          progress={props.pack.position / Math.max(1, props.pack.total)}
          accessibleLabel={t`Puzzle ${props.pack.position} of ${props.pack.total}`}
          dataSet={{ testid: 'puzzle-attempt-pack-track' }}
        />
      }
    >
      <ProgressBar
        size="sm"
        progress={(props.solved ?? 0) / Math.max(1, props.pack.total)}
        label={t`${props.solved ?? 0} of ${props.pack.total} solved`}
        dataSet={{ testid: 'puzzle-attempt-pack-track' }}
      />
    </Show>
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
      <Show when={props.pack}>
        {(pack) => <PackTrack pack={pack()} solved={props.packSolved} />}
      </Show>
      <Show when={(props.pack ?? null) !== null || props.playtest}>
        <StackHorizontal
          gap="sm"
          wrap
          dataSet={{ testid: 'puzzle-attempt-pack-actions' }}
        >
          {/* Once solved, the way on comes first, as on the board. */}
          <Show when={props.complete && props.pack}>{props.onward}</Show>
          {props.wayOn}
        </StackHorizontal>
      </Show>
      <AttemptFigures {...props} />
      <ContentAttemptSaveStatus {...props} />
      <Show when={props.playtest}>
        <Notice>
          <Trans>
            Playtest: this uses the real puzzle rules. It does not count toward
            personal or pack completion.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.playtest && props.complete}>
        <P variant="caption" tone="secondary">
          {t`Playtest solved. Return to the builder to publish it.`}
        </P>
      </Show>
      <Show
        when={!props.playtest && !props.complete && props.solvedBefore === true}
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
