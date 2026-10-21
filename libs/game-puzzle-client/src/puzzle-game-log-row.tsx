import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared/stats';
import { Trans } from '@lingui/solid/macro';
import { CircleCheckIcon, XIcon } from '@pkgs/ui-root-client/icons';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client/relative-time';
import { Text } from '@pkgs/ui-root-client/text';
import type { ColorTone } from '@pkgs/ui-root-shared/token-names';
import { type JSX, Match, Show, Switch } from 'solid-js';

function formatSignedDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function GameLogOutcome(props: {
  outcome: PuzzleGameLogEntry['outcome'];
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Abandoned</Trans>}>
      <Match when={props.outcome === 'solved'}>
        <Trans>Solved</Trans>
      </Match>
      <Match when={props.outcome === 'failed'}>
        <Trans>Failed</Trans>
      </Match>
    </Switch>
  );
}

function changeTone(entry: PuzzleGameLogEntry): ColorTone {
  if (!entry.rated || entry.delta === 0) return 'secondary';
  return entry.delta > 0 ? 'success' : 'destructive';
}

/** The rating change the puzzle made, in the colour of its direction. */
function GameLogChange(props: { entry: PuzzleGameLogEntry }): JSX.Element {
  return (
    <Text
      variant="label"
      numeral
      wrap="nowrap"
      tone={changeTone(props.entry)}
      testId={`chess-game-log-row-${props.entry.puzzleId}-change`}
    >
      <Show when={props.entry.rated} fallback={<Trans>Unrated</Trans>}>
        {formatSignedDelta(props.entry.delta)}
      </Show>
    </Text>
  );
}

export type PuzzleGameLogRowProps = {
  entry: PuzzleGameLogEntry;
  onClick: () => void;
};

/**
 * One played puzzle: how it went and the puzzle's rating, when, and what it
 * did to the player's rating. A row of the game log panel.
 */
export function PuzzleGameLogRow(props: PuzzleGameLogRowProps): JSX.Element {
  const timeLabel = useRelativeTimeLabel(() => props.entry.at);
  const solved = () => props.entry.outcome === 'solved';
  return (
    <MenuRow
      dataSet={{ testid: `chess-game-log-row-${props.entry.puzzleId}` }}
      onClick={props.onClick}
      leading={
        <Show
          when={solved()}
          fallback={<XIcon size={20} color="destructive" />}
        >
          <CircleCheckIcon size={20} color="success" />
        </Show>
      }
      title={
        // The puzzle's own rating follows the outcome, a tone quieter.
        <Text
          variant="inherit"
          testId={`chess-game-log-row-${props.entry.puzzleId}-title`}
        >
          <GameLogOutcome outcome={props.entry.outcome} />{' '}
          <Text variant="inherit" numeral tone="secondary">
            {props.entry.puzzleRating}
          </Text>
        </Text>
      }
      caption={timeLabel()}
      value={<GameLogChange entry={props.entry} />}
    />
  );
}
