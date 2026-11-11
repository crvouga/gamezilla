import { PUZZLE_NAV_INTENT } from '@libs/game-puzzle-shared-ts/puzzle-nav';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MoveStrip, MoveStripSlot } from '@pkgs/ui-root-client-ts/move-strip';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { PuzzleActionBar } from './puzzle-action-bar';
import { HistoryPlyCluster } from './puzzle-move-history-ply';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
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
 * hint waits, and the way back to the latest move is offered under it.
 */
export function PuzzleSolveActions(
  props: PuzzlePlayScreenViewProps
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
      />
      <Show when={props.canGoForward}>
        <StackHorizontal align="center" gap="sm" wrap>
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
    </StackVertical>
  );
}

/**
 * The line so far as one quiet strip of moves, read not pressed, and the
 * one control that opens the screen where it is stepped through.
 */
function CompactLine(props: PuzzlePlayScreenViewProps): JSX.Element {
  const { t } = useLingui();
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
      <Show when={hasPlies() && !props.spectator}>
        <Button
          title={<Trans>Look back</Trans>}
          intent="neutral"
          variant="ghost"
          size="sm"
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
      <Show when={!props.spectator}>
        <StackVertical paddingX="lg">
          <MenuSection>
            <PuzzleSettingsRow
              feed={props.feed}
              allowanceLabel={props.allowanceLabel}
              onOpen={() => props.onOpen({ screen: 'feed' })}
            />
          </MenuSection>
        </StackVertical>
      </Show>
    </StackVertical>
  );
}
