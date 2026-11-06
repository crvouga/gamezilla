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
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  type Accessor,
  createMemo,
  createSignal,
  type JSX,
  Show,
} from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorBoundary,
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
  const [chosen, setChosen] = createSignal<{
    cell: string;
    tool: QuoridorTool;
    position: string;
  } | null>(null);
  const selected = () => {
    const value = chosen();
    return value?.tool === tool() && value.position === props.position
      ? value.cell
      : null;
  };
  const previewAction = () =>
    !props.interactive ||
    (selected() ?? preview()) === null ||
    tool() === 'move'
      ? null
      : `${selected() ?? preview()}${tool()}`;
  // Memoized: each square reads the list, so computing it inline would
  // rebuild the whole board once per square on every change.
  const cells = createMemo(() =>
    quoridorBoardCells(game(), tool(), props.interactive, previewAction())
  );
  const message = () => {
    if (game().winner !== null)
      return t`Game finished. Use the game controls to review earlier moves.`;
    if (!props.interactive)
      return t`This board is read-only. Follow the game or review earlier moves.`;
    if (quoridorMustPass(game()))
      return t`No legal move or wall. Pass to continue.`;
    const action = previewAction();
    return action === null
      ? props.state.refusal()
      : `${quoridorBoundary(action)} ${quoridorWallMessage(wallRefusal(game(), action))}`;
  };
  const activate = (cell: string): void => {
    const action = tool() === 'move' ? cell : `${cell}${tool()}`;
    if (tool() !== 'move') {
      setChosen({ cell, tool: tool(), position: props.position });
      return;
    }
    props.state.setRefusal('');
    setPreview(null);
    props.onAction(action);
  };
  return (
    <StackVertical gap="sm">
      <CellGridBoard
        boardTheme="quoridor"
        fill
        label={t`Quoridor board, nine columns and nine rows`}
        testId={props.testId}
        columnLabels={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}
        rowLabels={['9', '8', '7', '6', '5', '4', '3', '2', '1']}
        cells={cells()}
        cellTestId={(cell) =>
          `${props.testId}-action-${cell}${tool() === 'move' ? '' : tool()}`
        }
        onActivate={activate}
        onPreview={setPreview}
      />
      <Show when={selected() !== null && props.interactive}>
        <WallConfirmation
          testId={props.testId}
          enabled={wallRefusal(game(), `${selected()}${tool()}`) === null}
          cancel={() => {
            setChosen(null);
            setPreview(null);
          }}
          commit={() => {
            const action = `${selected()}${tool()}`;
            if (wallRefusal(game(), action) !== null) return;
            setChosen(null);
            setPreview(null);
            props.state.setRefusal('');
            props.onAction(action);
          }}
        />
      </Show>
      <P role="status" dataSet={{ testid: `${props.testId}-wall-status` }}>
        {message() || toolGuidance(tool())}
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
      enabled: live() && !quoridorMustPass(game()),
      pressed: tool() === each,
      run: () => {
        setTool(each);
        setRefusal('');
      },
    }));
  const pass = (): GameFrameAction => ({
    id: 'action-pass',
    label: t`No legal move or wall — pass turn`,
    emphasis: 'primary',
    enabled: props.interactive,
    run: () => props.onAction('pass'),
  });
  return {
    Board: () => <QuoridorBoardView {...props} state={state} />,
    actions: () => (quoridorMustPass(game()) ? [pass()] : toolActions()),
  };
}

/** The board alone, its tools left to whoever mounts it with its actions. */
export function QuoridorBoard(props: GameBoardProps): JSX.Element {
  return createQuoridorBoard(props).Board();
}

function WallConfirmation(props: {
  testId: string;
  enabled: boolean;
  cancel: () => void;
  commit: () => void;
}): JSX.Element {
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title={t`Place wall`}
        disabled={!props.enabled}
        dataSet={{ testid: `${props.testId}-wall-commit` }}
        onClick={props.commit}
      />
      <Button
        title={t`Cancel`}
        variant="outline"
        dataSet={{ testid: `${props.testId}-wall-cancel` }}
        onClick={props.cancel}
      />
    </StackHorizontal>
  );
}

function toolGuidance(tool: QuoridorTool): string {
  if (tool === 'move') return t`Choose a marked square to move your pawn.`;
  return tool === 'h'
    ? t`Horizontal wall: choose a square to preview its upper boundary.`
    : t`Vertical wall: choose a square to preview its right boundary.`;
}
