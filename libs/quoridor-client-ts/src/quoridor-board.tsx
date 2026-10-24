import {
  decodeQuoridor,
  quoridorMustPass,
  wallRefusal,
} from '@libs/quoridor-shared-ts/quoridor';
import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorPlayerName,
  quoridorWallMessage,
} from './quoridor-board-cells';

function QuoridorTools(props: {
  tool: QuoridorTool;
  testId: string;
  interactive: boolean;
  onSelect: (tool: QuoridorTool) => void;
}): JSX.Element {
  const labels = () => ({
    move: t`Move pawn`,
    h: t`Horizontal wall`,
    v: t`Vertical wall`,
  });
  return (
    <StackHorizontal gap="sm" wrap>
      <For each={['move', 'h', 'v'] as const}>
        {(tool) => (
          <Button
            title={labels()[tool]}
            disabled={!props.interactive}
            intent={props.tool === tool ? 'primary' : 'neutral'}
            variant={props.tool === tool ? 'solid' : 'outline'}
            aria-pressed={props.tool === tool}
            dataSet={{ testid: `${props.testId}-mode-${tool}` }}
            onClick={() => props.onSelect(tool)}
          />
        )}
      </For>
    </StackHorizontal>
  );
}

export function QuoridorBoard(props: {
  position: string;
  interactive: boolean;
  testId: string;
  onAction: (action: string) => void;
}): JSX.Element {
  const game = createMemo(() => decodeQuoridor(props.position));
  const [tool, setTool] = createSignal<QuoridorTool>('move');
  const [preview, setPreview] = createSignal<string | null>(null);
  const [refusal, setRefusal] = createSignal('');
  const previewAction = () =>
    !props.interactive || preview() === null || tool() === 'move'
      ? null
      : `${preview()}${tool()}`;
  const message = () => {
    if (game().winner !== null)
      return t`Game finished. Use the game controls to review earlier moves.`;
    if (!props.interactive)
      return t`This board is read-only. Follow the game or review earlier moves.`;
    const action = previewAction();
    return action === null
      ? refusal()
      : quoridorWallMessage(wallRefusal(game(), action));
  };
  const activate = (cell: string): void => {
    const action = tool() === 'move' ? cell : `${cell}${tool()}`;
    if (tool() !== 'move') {
      const reason = wallRefusal(game(), action);
      if (reason !== null) {
        setRefusal(quoridorWallMessage(reason));
        return;
      }
    }
    setRefusal('');
    setPreview(null);
    props.onAction(action);
  };
  return (
    <StackVertical gap="sm">
      <P>
        {game().mode === 'hill'
          ? t`First to e5 wins immediately. Everyone keeps a path to the hill.`
          : t`Reach the opposite home row first. South heads to row 9; North heads to row 1.`}
      </P>
      <StackHorizontal gap="sm" wrap>
        <For each={game().pawns}>
          {(_, player) => (
            <P
              variant="caption"
              dataSet={{ testid: `${props.testId}-player-${player()}` }}
            >
              {quoridorPlayerName(game(), player())}:{' '}
              {game().remaining[player()]}{' '}
              {game().remaining[player()] === 1 ? t`wall` : t`walls`}
              {game().winner === null && game().turn === player()
                ? t` — to move`
                : ''}
            </P>
          )}
        </For>
      </StackHorizontal>
      <QuoridorTools
        tool={tool()}
        testId={props.testId}
        interactive={props.interactive && game().winner === null}
        onSelect={(next) => {
          setTool(next);
          setRefusal('');
        }}
      />
      <Show when={quoridorMustPass(game())}>
        <Button
          title={t`No legal move or wall — pass turn`}
          disabled={!props.interactive}
          dataSet={{ testid: `${props.testId}-action-pass` }}
          onClick={() => props.onAction('pass')}
        />
      </Show>
      <CellGridBoard
        label={t`Quoridor board, nine columns and nine rows`}
        testId={props.testId}
        columnLabels={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}
        rowLabels={['9', '8', '7', '6', '5', '4', '3', '2', '1']}
        cells={quoridorBoardCells(
          game(),
          tool(),
          props.interactive,
          previewAction()
        )}
        cellTestId={(cell) =>
          `${props.testId}-action-${cell}${tool() === 'move' ? '' : tool()}`
        }
        onActivate={activate}
        onPreview={setPreview}
      />
      <P role="status" dataSet={{ testid: `${props.testId}-wall-status` }}>
        {message() ||
          t`Arrow keys move focus. Enter or Space chooses a square. For a wall, choose its lower-left anchor.`}
      </P>
    </StackVertical>
  );
}
