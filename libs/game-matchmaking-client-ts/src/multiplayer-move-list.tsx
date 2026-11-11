import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ListEntry, OrderedList } from '@pkgs/ui-root-client-ts/semantic-list';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import type {
  MultiplayerMoveShown,
  MultiplayerMovesShown,
} from './multiplayer-game-view';

type ListProps = {
  readonly moves: MultiplayerMovesShown;
  /** Shows the position after `ply` moves. */
  readonly onChoose: (ply: number) => void;
};

/** One move of the list: choosing it shows the position after it. */
function MoveChoice(
  props: ListProps & { readonly move: MultiplayerMoveShown }
): JSX.Element {
  const shown = () => props.moves.shownPly === props.move.ply;
  return (
    <ListEntry>
      <StackHorizontal align="center" gap="xs">
        <Show when={props.move.numbering !== ''}>
          <Text variant="caption" numeral>
            {props.move.numbering}
          </Text>
        </Show>{' '}
        <Button
          title={props.move.san}
          size="sm"
          variant={shown() ? 'solid' : 'ghost'}
          intent="neutral"
          aria-label={t`Show the position after ${props.move.name}`}
          aria-current={shown()}
          onClick={() => props.onChoose(props.move.ply)}
          dataSet={{ testid: `multiplayer-move-${String(props.move.ply)}` }}
        />{' '}
      </StackHorizontal>
    </ListEntry>
  );
}

/**
 * The accepted moves in the game's notation, each one a position to
 * choose, the one on the board marked.
 */
export function MultiplayerMoveList(props: ListProps): JSX.Element {
  return (
    <>
      <StackHorizontal wrap align="center" gap="sm">
        <OrderedList
          aria-label={t`Moves played`}
          testId="multiplayer-move-list"
        >
          <For each={props.moves.moves}>
            {(move) => <MoveChoice {...props} move={move} />}
          </For>
        </OrderedList>
      </StackHorizontal>
      <Show when={props.moves.moves.length === 0}>
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
      </Show>
    </>
  );
}
