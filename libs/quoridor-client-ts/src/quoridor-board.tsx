import {
  decodeQuoridor,
  type Quoridor,
  quoridorMustPass,
  wallRefusal,
} from '@libs/quoridor-shared-ts/quoridor';
import { t } from '@lingui/core/macro';
import type {
  GameFrameAction,
  GameFrameBoardSession,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, createSignal, type JSX } from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorWallMessage,
} from './quoridor-board-cells';

const TOOLS: readonly QuoridorTool[] = ['move', 'h', 'v'];

function toolLabel(tool: QuoridorTool): string {
  if (tool === 'move') return t`Move pawn`;
  return tool === 'h' ? t`Horizontal wall` : t`Vertical wall`;
}

type BoardState = {
  readonly game: Accessor<Quoridor>;
  readonly tool: Accessor<QuoridorTool>;
  readonly refusal: Accessor<string>;
  readonly setRefusal: (message: string) => void;
};

function QuoridorBoardView(
  props: GameBoardProps & { readonly state: BoardState }
): JSX.Element {
  const game = (): Quoridor => props.state.game();
  const tool = (): QuoridorTool => props.state.tool();
  const [preview, setPreview] = createSignal<string | null>(null);
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
      ? props.state.refusal()
      : quoridorWallMessage(wallRefusal(game(), action));
  };
  const activate = (cell: string): void => {
    const action = tool() === 'move' ? cell : `${cell}${tool()}`;
    if (tool() !== 'move') {
      const reason = wallRefusal(game(), action);
      if (reason !== null) {
        props.state.setRefusal(quoridorWallMessage(reason));
        return;
      }
    }
    props.state.setRefusal('');
    setPreview(null);
    props.onAction(action);
  };
  return (
    <StackVertical gap="sm">
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

/**
 * The Quoridor board and its tools. The tool chosen (move the pawn, or a
 * horizontal or vertical wall) is shared by the board, which places what it
 * says, and the frame's action bar, which offers each tool (`mode-move`,
 * `mode-h`, `mode-v`) and, when no move or wall is legal, the pass
 * (`action-pass`).
 */
export function createQuoridorBoard(
  props: GameBoardProps
): GameFrameBoardSession<JSX.Element> {
  const game = createMemo(() => decodeQuoridor(props.position));
  const [tool, setTool] = createSignal<QuoridorTool>('move');
  const [refusal, setRefusal] = createSignal('');
  const live = (): boolean => props.interactive && game().winner === null;
  const state: BoardState = { game, tool, refusal, setRefusal };
  const toolActions = (): readonly GameFrameAction[] =>
    TOOLS.map((each) => ({
      id: `mode-${each}`,
      label: toolLabel(each),
      enabled: live(),
      pressed: tool() === each,
      run: () => {
        setTool(each);
        setRefusal('');
      },
    }));
  const pass = (): GameFrameAction => ({
    id: 'action-pass',
    label: t`No legal move or wall — pass turn`,
    enabled: props.interactive,
    run: () => props.onAction('pass'),
  });
  return {
    Board: () => <QuoridorBoardView {...props} state={state} />,
    actions: () =>
      quoridorMustPass(game()) ? [...toolActions(), pass()] : toolActions(),
  };
}

/** The board alone, its tools left to whoever mounts it with its actions. */
export function QuoridorBoard(props: GameBoardProps): JSX.Element {
  return createQuoridorBoard(props).Board();
}
