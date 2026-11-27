import { PUZZLE_NAV_INTENT } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MoveStrip, MoveStripSlot } from '@pkgs/ui-root-client-ts/move-strip';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { HistoryPlyCluster } from './puzzle-move-history-ply';
import type { PuzzleStageScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSettingsRow } from './puzzle-settings-row';

const ignoreSeek = (): void => {};

/** A watcher sees what is left of the host's rated allowance. */
export function SpectatorAllowance(props: { label: string }): JSX.Element {
  return (
    <Show when={props.label.length > 0}>
      <StackVertical paddingX="md" paddingY="xs">
        <P
          variant="caption"
          tone="secondary"
          testId="chess-puzzle-remaining-today"
        >
          {props.label}
        </P>
      </StackVertical>
    </Show>
  );
}

/**
 * What is done about the puzzle, as the solve state allows it
 * (`buildPuzzleActionBarPlan`). While the board shows an earlier move the
 * hint waits.
 */
export function PuzzleSolveActions(
  props: PuzzleStageScreenViewProps
): JSX.Element {
  return (
    <StackVertical paddingX="lg" gap="sm">
      <PuzzleActionBar
        status={props.status}
        hintStage={props.hintStage}
        canGoForward={props.canGoForward}
        onHint={props.onHint}
        onSolution={props.onSolution}
        onRetry={props.onRetry}
        onSkip={props.onSkip}
        onNext={props.onNext}
        beside={
          <Show when={props.line.plies.length > 0}>
            <Button
              title={<Trans>Look back</Trans>}
              intent="neutral"
              variant="outline"
              size="sm"
              flex={1}
              onClick={() => props.onOpen({ screen: 'line' })}
              dataSet={{ testid: 'chess-puzzle-line-open' }}
            />
          </Show>
        }
        settings={
          <Show when={!props.spectator}>
            <PuzzleSettingsRow
              feed={props.feed}
              allowanceLabel={props.allowanceLabel}
              onOpen={() => props.onOpen({ screen: 'feed' })}
            />
          </Show>
        }
      />
    </StackVertical>
  );
}

export function EarlierPosition(
  props: PuzzleStageScreenViewProps
): JSX.Element {
  return (
    <Show when={props.canGoForward && !props.spectator}>
      <StackHorizontal align="center" gap="sm" paddingX="lg" wrap>
        <P variant="caption" tone="secondary">
          <Trans>The board shows an earlier move.</Trans>
        </P>
        <Button
          title={<Trans>Back to the latest move</Trans>}
          intent="neutral"
          variant="ghost"
          size="sm"
          onClick={() => props.line.nav.onNavigate(PUZZLE_NAV_INTENT.end)}
          dataSet={{ testid: 'chess-puzzle-return-live' }}
        />
      </StackHorizontal>
    </Show>
  );
}

/**
 * The line so far as one quiet strip of moves, read not pressed, and the
 * one control that opens the screen where it is stepped through.
 */
export function CompactLine(props: PuzzleStageScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const hasPlies = (): boolean => props.line.plies.length > 0;
  return (
    // One line, the latest move in view, in the fixed row over the board.
    <StackHorizontal align="center" gap="sm" grow testId="chess-puzzle-moves">
      <StackVertical grow>
        <MoveStrip testId="chess-puzzle-move-history" overflow="scroll">
          <Show when={hasPlies()}>
            <For each={props.line.plies}>
              {(ply) => (
                <HistoryPlyCluster
                  ply={ply}
                  selectedSolveIdx={props.line.selectedSolveIdx}
                  interactive={false}
                  writing={props.line.writing}
                  onSeek={ignoreSeek}
                />
              )}
            </For>
            <Show when={props.line.awaiting}>
              <MoveStripSlot
                label={t`Your move`}
                testId="chess-puzzle-move-slot"
              />
            </Show>
          </Show>
        </MoveStrip>
      </StackVertical>
    </StackHorizontal>
  );
}


