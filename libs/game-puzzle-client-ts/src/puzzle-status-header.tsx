import type { PuzzleStatusKind } from '@libs/game-puzzle-shared-ts/status-kind';
import { Trans } from '@lingui/solid/macro';
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

/** §5 prompt once the setup move has played: the solver is to move. */
function yourTurnLabel(side: string): JSX.Element {
  return <Trans>Your turn — find the best move for {side}</Trans>;
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
  // The row is as tall as its content: a prompt that wraps to two lines
  // grows it rather than overlapping the coach's message below.
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
        <P variant="label" lines={2} testId="chess-puzzle-status-label">
          <Show
            when={props.kind === 'started' ? props.solverSide : null}
            fallback={statusLabel(props.kind)}
          >
            {(side) => yourTurnLabel(side())}
          </Show>
        </P>
      </StackVertical>
      {props.trailing}
    </StackHorizontal>
  );
}
