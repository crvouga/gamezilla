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
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
} from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorBoundary,
  quoridorWallMessage,
} from './quoridor-board-cells';
import {
  QuoridorBoardTools,
  QuoridorTargetPicker,
} from './quoridor-board-tools';

const TOOLS: readonly QuoridorTool[] = ['move', 'h', 'v'];

function toolLabel(tool: QuoridorTool): string {
  if (tool === 'move') return t`Move pawn`;
  return tool === 'h' ? t`Horizontal wall` : t`Vertical wall`;
}

type BoardState = {
  readonly game: Accessor<Quoridor>;
  readonly tool: Accessor<QuoridorTool>;
  readonly refusal: Accessor<string>;
  readonly actions: Accessor<readonly GameFrameAction[]>;
  readonly setRefusal: (message: string) => void;
};

type BoardViewProps = GameBoardProps & { readonly state: BoardState };

function createBoardSelection(props: BoardViewProps) {
  const game = (): Quoridor => props.state.game();
  const tool = (): QuoridorTool => props.state.tool();
  const [preview, setPreview] = createSignal<string | null>(null);
  const [chosen, setChosen] = createSignal<{
    cell: string;
    position: string;
  } | null>(null);
  const cancel = () => {
    setChosen(null);
    setPreview(null);
  };
  createEffect(on([() => props.position, () => props.syncKey], cancel));
  createEffect(() => {
    if (tool() === 'move') cancel();
  });
  const selected = () => {
    const value = chosen();
    return tool() !== 'move' && value?.position === props.position
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
    if ((game().remaining[game().turn] ?? 0) === 0)
      return quoridorWallMessage('no-walls');
    const action = previewAction();
    return action === null
      ? props.state.refusal()
      : `${quoridorBoundary(action)}. ${quoridorWallMessage(wallRefusal(game(), action))}`;
  };
  const activate = (cell: string): void => {
    const action = tool() === 'move' ? cell : `${cell}${tool()}`;
    if (tool() !== 'move') {
      setChosen({ cell, position: props.position });
      return;
    }
    props.state.setRefusal('');
    setPreview(null);
    props.onAction(action);
  };
  const commit = () => {
    const action = `${selected()}${tool()}`;
    if (wallRefusal(game(), action) !== null) return;
    cancel();
    props.state.setRefusal('');
    props.onAction(action);
  };
  return { cells, selected, message, activate, setPreview, cancel, commit };
}

function QuoridorBoardView(props: BoardViewProps): JSX.Element {
  const game = (): Quoridor => props.state.game();
  const tool = (): QuoridorTool => props.state.tool();
  const selection = createBoardSelection(props);
  return (
    <StackVertical gap="xs">
      <Show when={game().winner === null && quoridorMustPass(game())}>
        <QuoridorBoardTools
          testId={props.testId}
          actions={props.state.actions()}
        />
      </Show>
      <CellGridBoard
        boardTheme="quoridor"
        fill
        label={t`Quoridor board, nine columns and nine rows`}
        describedBy={`${props.testId}-wall-status`}
        testId={props.testId}
        columnLabels={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}
        rowLabels={['9', '8', '7', '6', '5', '4', '3', '2', '1']}
        cells={selection.cells()}
        cellTestId={(cell) =>
          `${props.testId}-action-${cell}${tool() === 'move' ? '' : tool()}`
        }
        onActivate={selection.activate}
        onPreview={selection.setPreview}
        onCellKey={(key) => {
          if (key !== 'Escape') return false;
          selection.cancel();
          return true;
        }}
      />
      <Show
        when={
          props.interactive &&
          game().winner === null &&
          !quoridorMustPass(game())
        }
      >
        <QuoridorBoardTools
          testId={props.testId}
          actions={props.state.actions()}
        />
        <QuoridorTargetPicker
          testId={props.testId}
          tool={tool()}
          cells={selection.cells()}
          selected={selection.selected()}
          onActivate={selection.activate}
        />
      </Show>
      <Show when={selection.selected() !== null && props.interactive}>
        <WallConfirmation
          testId={props.testId}
          enabled={
            wallRefusal(game(), `${selection.selected()}${tool()}`) === null
          }
          cancel={selection.cancel}
          commit={selection.commit}
        />
      </Show>
      <P
        id={`${props.testId}-wall-status`}
        role="status"
        dataSet={{ testid: `${props.testId}-wall-status` }}
      >
        {selection.message() || toolGuidance(tool())}
      </P>
    </StackVertical>
  );
}

/** Board-local tools keep mode, precise target selection and confirmation together. */
export function createQuoridorBoard(
  props: GameBoardProps
): GameFrameBoardSession<JSX.Element> {
  const game = createMemo(() => decodeQuoridor(props.position));
  const [tool, setTool] = createSignal<QuoridorTool>('move');
  const [refusal, setRefusal] = createSignal('');
  const live = (): boolean => props.interactive && game().winner === null;
  const toolActions = (): readonly GameFrameAction[] =>
    TOOLS.map((each) => ({
      id: `mode-${each}`,
      label: toolLabel(each),
      enabled:
        live() &&
        !quoridorMustPass(game()) &&
        (each === 'move' || (game().remaining[game().turn] ?? 0) > 0),
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
  const state: BoardState = {
    game,
    tool,
    refusal,
    setRefusal,
    actions: () => (quoridorMustPass(game()) ? [pass()] : toolActions()),
  };
  return {
    Board: () => <QuoridorBoardView {...props} state={state} />,
    actions: () => [],
  };
}

/** The board with its adjacent tools and precise coordinate picker. */
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
  if (tool === 'move') return t`Move to a marked square.`;
  return tool === 'h'
    ? t`Tap a square: preview a wall above it.`
    : t`Tap a square: preview a wall to its right.`;
}
