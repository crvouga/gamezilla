import { PUZZLE_NAV_INTENT } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ListOrderedIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { PuzzleScreenFold } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { HistoryPlyPairs } from './puzzle-move-history-ply';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSettingsButton, PuzzleSettingsRow } from './puzzle-settings-row';

const ignoreSeek = (): void => {};

/**
 * A watcher's own line over the status line: that they are watching, and
 * what is left of the host's rated allowance.
 */
export function SpectatorAllowance(props: { label: string }): JSX.Element {
  return (
    <StackHorizontal align="center" gap="sm" paddingX="md" paddingY="xs" wrap>
      <SpectatorIndicator />
      <Show when={props.label.length > 0}>
        <P
          variant="caption"
          tone="secondary"
          testId="chess-puzzle-remaining-today"
        >
          {props.label}
        </P>
      </Show>
    </StackHorizontal>
  );
}

/**
 * What is done about the puzzle, as the solve state allows it
 * (`buildPuzzleActionBarPlan`), docked in reach of the thumb.
 */
export function PuzzleSolveDock(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <StackVertical gap="sm">
      {/* A wrong move's cost is said before the choice, not after it. */}
      <Show when={props.status === 'wrong'}>
        <P variant="caption" tone="secondary" testId="chess-puzzle-wrong-cost">
          <Trans>
            This attempt now counts as failed. Retry to finish the line.
          </Trans>
        </P>
      </Show>
      <PuzzleActionBar
        status={props.status}
        hintStage={props.hintStage}
        canGoForward={props.canGoForward}
        onHint={props.onHint}
        onSolution={props.onSolution}
        onRetry={props.onRetry}
        onSkip={props.onSkip}
        onNext={props.onNext}
        extra={
          // A short phone has no room for the settings row: its way to the
          // settings is here, beside the commands.
          <Show when={props.status !== 'wrong'}>
            <PuzzleScreenFold on="short">
              <PuzzleSettingsButton
                onOpen={() => props.onOpen({ screen: 'feed' })}
              />
            </PuzzleScreenFold>
          </Show>
        }
      />
    </StackVertical>
  );
}

/**
 * While the board shows an earlier move the hint waits, and the way back
 * to the latest move is offered under the board.
 */
export function PuzzleSolveActions(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return (
    <Show when={props.canGoForward}>
      <StackHorizontal align="center" gap="sm" wrap paddingX="lg">
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
 * one control that opens the screen where it is stepped through. Whose
 * move it is, is the status line's turn pill alone.
 */
function CompactLine(props: PuzzlePlayScreenViewProps): JSX.Element {
  const hasPlies = (): boolean => props.line.plies.length > 0;
  return (
    <StackHorizontal
      align="center"
      gap="sm"
      paddingX="lg"
      testId="chess-puzzle-moves"
    >
      <StackVertical grow>
        <MoveStrip testId="chess-puzzle-move-history" overflow="wrap">
          <Show when={hasPlies()}>
            <HistoryPlyPairs
              plies={props.line.plies}
              selectedSolveIdx={props.line.selectedSolveIdx}
              interactive={false}
              writing={props.line.writing}
              onSeek={ignoreSeek}
            />
          </Show>
        </MoveStrip>
      </StackVertical>
      <Show when={hasPlies() && !props.spectator}>
        <Button
          title={<Trans>Review moves</Trans>}
          intent="neutral"
          variant="outline"
          size="sm"
          icon={ListOrderedIcon}
          onClick={() => props.onOpen({ screen: 'line' })}
          dataSet={{ testid: 'chess-puzzle-line-open' }}
        />
      </Show>
    </StackHorizontal>
  );
}

/**
 * The `play` place's line: the moves so far and, for the solver, the one
 * row to the puzzle settings.
 */
export function PuzzleSolveLine(props: PuzzlePlayScreenViewProps): JSX.Element {
  return (
    <StackVertical gap="md">
      <CompactLine {...props} />
      {/* While a wrong move waits on Retry, Reveal or Skip, the settings
          step aside: the choice and the dock keep the first view. */}
      <Show when={!props.spectator && props.status !== 'wrong'}>
        <PuzzleScreenFold on="tall">
          <StackVertical paddingX="lg">
            <MenuSection>
              <PuzzleSettingsRow
                feed={props.feed}
                allowanceLabel={props.allowanceLabel}
                onOpen={() => props.onOpen({ screen: 'feed' })}
              />
            </MenuSection>
          </StackVertical>
        </PuzzleScreenFold>
      </Show>
    </StackVertical>
  );
}
