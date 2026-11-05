import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { PuzzleStatusIcon } from './puzzle-status-icons';

function statusLabel(kind: PuzzleStatusKind): JSX.Element | null {
  switch (kind) {
    case 'loading':
      return <Trans>Loading puzzle…</Trans>;
    case 'empty':
      return <Trans>No puzzles left</Trans>;
    case 'offline':
      return <Trans>Offline</Trans>;
    case 'limited':
      return <Trans>Daily limit reached</Trans>;
    case 'waiting':
      return <Trans>Waiting for the host</Trans>;
    case 'started':
      return <Trans>Started</Trans>;
    case 'failed':
      return <Trans>Failed</Trans>;
    case 'skipped':
      return <Trans>Skipped</Trans>;
    case 'solved':
      return <Trans>Solved</Trans>;
    default:
      return null;
  }
}

/**
 * §5 prompt once the setup move has played: the solver's side is to move,
 * in the board's own words; the coach beside it adds the one hint worth
 * saying, so the two never repeat each other.
 */
function yourTurnLabel(side: string): JSX.Element {
  return <Trans>{side} to move</Trans>;
}

export type PuzzleStatusHeaderProps = {
  kind: PuzzleStatusKind;
  /**
   * The solver's side, as the game names it: the `started` label becomes
   * the §5 "your turn" prompt.
   */
  solverSide?: string | null;
  /** Right-aligned slot, e.g. the puzzle clock. */
  trailing?: JSX.Element;
};

export function PuzzleStatusHeader(
  props: PuzzleStatusHeaderProps
): JSX.Element {
  // The row is as tall as its content: a prompt that wraps grows it rather
  // than overlapping the coach's message below. Three lines keep the whole
  // prompt beside the clock in the narrow panel beside a wide board.
  return (
    <StackHorizontal
      align="center"
      gap="sm"
      self="stretch"
      paddingBottom="xs"
      testId="chess-puzzle-status-row"
    >
      <PuzzleStatusIcon kind={props.kind} />
      <StackVertical grow>
        <P variant="label" lines={3} testId="chess-puzzle-status-label">
          <Show
            when={props.kind === 'started' ? props.solverSide : null}
            fallback={statusLabel(props.kind)}
          >
            {/* The solver's turn in the accent pill the game screens put on
                the seat to move, right above (or beside) the board. */}
            {(side) => (
              <Badge
                intent="brand"
                tone="solid"
                label={yourTurnLabel(side())}
                dataSet={{ testid: 'chess-puzzle-your-move' }}
              />
            )}
          </Show>
        </P>
      </StackVertical>
      {props.trailing}
    </StackHorizontal>
  );
}
