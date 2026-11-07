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
function yourTurnLabel(side: string, correct: boolean): JSX.Element {
  return correct ? (
    <Trans>Correct · {side} to move</Trans>
  ) : (
    <Trans>{side} to move</Trans>
  );
}

export type PuzzleStatusHeaderProps = {
  kind: PuzzleStatusKind;
  /** A revealed attempt teaches the line rather than reporting a wrong move. */
  solutionShown?: boolean | undefined;
  /**
   * The solver's side, as the game names it: the `started` label becomes
   * the §5 "your turn" prompt.
   */
  solverSide?: string | null;
  /**
   * The solver's last move was right and the line goes on: the turn pill
   * says so in the success colour instead of the plain accent.
   */
  correct?: boolean | undefined;
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
      <Show when={!props.solutionShown}>
        <PuzzleStatusIcon kind={props.kind} />
      </Show>
      <StackVertical grow>
        <P variant="label" lines={3} testId="chess-puzzle-status-label">
          <Show
            when={
              !props.solutionShown && props.kind === 'started'
                ? props.solverSide
                : null
            }
            fallback={
              props.solutionShown ? (
                <Trans>Solution shown</Trans>
              ) : (
                statusLabel(props.kind)
              )
            }
          >
            {/* The solver's turn in the accent pill the game screens put on
                the seat to move, right above (or beside) the board. */}
            {(side) => (
              <Badge
                intent={props.correct === true ? 'success' : 'brand'}
                tone="solid"
                label={yourTurnLabel(side(), props.correct === true)}
                dataSet={{
                  testid: 'chess-puzzle-your-move',
                  correct: String(props.correct === true),
                }}
              />
            )}
          </Show>
        </P>
      </StackVertical>
      {props.trailing}
    </StackHorizontal>
  );
}
