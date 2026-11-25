import {
  decodeQuoridor,
  type Quoridor,
  quoridorCellName,
  quoridorMustPass,
  wallRefusal,
} from '@libs/quoridor-shared-ts/quoridor';
import { t } from '@lingui/core/macro';
import { QuoridorSurface } from '@pkgs/quoridor-board-client-ts/surface';
import type {
  GameFrameAction,
  GameFrameBoardSession,
} from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { createFocusTarget } from '@pkgs/ui-root-client-ts/focus';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  Show,
} from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorBoundary,
  quoridorPlayerName,
  quoridorWallMessage,
  withWallPreview,
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
  readonly setTool: (tool: QuoridorTool) => void;
};

type BoardViewProps = GameBoardProps & { readonly state: BoardState };

/**
 * Why the chosen wall, or the host, refused the last attempt (`''` for
 * nothing refused): an alert over the screen, so the board and its tools
 * never move for it.
 */
function refusalReason(props: BoardViewProps, wall: string | null): string {
  const game = props.state.game();
  const reason =
    wall === null ? null : wallRefusal(game, `${wall}${props.state.tool()}`);
  if (reason !== null) return quoridorWallMessage(reason, game.mode);
  return props.interactive ? props.state.refusal() : '';
}

function boardMessage(
  props: BoardViewProps,
  previewAction: Accessor<string | null>
): string {
  const game = props.state.game();
  if (game.winner !== null)
    return t`Game finished. Choose a move in the moves list to see the board at that point.`;
  if (!props.interactive)
    return t`Waiting for ${quoridorPlayerName(game, game.turn)} to move. This board is read-only.`;
  if (quoridorMustPass(game))
    return t`No legal move or wall. Pass to continue.`;
  const action = previewAction();
  if (action !== null)
    return `${quoridorBoundary(action)}. ${quoridorWallMessage(wallRefusal(game, action), game.mode)}`;
  // A host refusal explains the last attempt; it outranks standing guidance.
  const refused = props.state.refusal();
  if (refused !== '') return refused;
  return (game.remaining[game.turn] ?? 0) === 0
    ? quoridorWallMessage('no-walls', game.mode)
    : '';
}

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
  createEffect(() => [props.position, props.syncKey] as const, cancel);
  createEffect(
    () => tool() === 'move',
    (moving) => {
      if (moving) cancel();
    }
  );
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
  const targets = createMemo(() =>
    quoridorBoardCells(game(), tool(), props.interactive)
  );
  const cells = createMemo(() => {
    const action = previewAction();
    return withWallPreview(
      targets(),
      action,
      action !== null && wallRefusal(game(), action) !== null
    );
  });
  const message = () => boardMessage(props, previewAction);
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
    // The wall is spent: the next turn starts with the pawn tool.
    props.state.setTool('move');
    props.onAction(action);
  };
  const refusal = () => refusalReason(props, selected());
  return {
    cells,
    selected,
    message,
    refusal,
    activate,
    setPreview,
    cancel,
    commit,
  };
}

function PlayingSurface(
  props: BoardViewProps & { selection: ReturnType<typeof createBoardSelection> }
): JSX.Element {
  const game = () => props.state.game();
  const tool = () => props.state.tool();
  return (
    <QuoridorSurface
      revision={props.position}
      syncKey={props.syncKey}
      tool={tool()}
      pawn={quoridorCellName(game().pawns[game().turn] ?? 0)}
      interactive={props.interactive && game().winner === null}
      onPreview={props.selection.setPreview}
      onDrop={props.selection.activate}
      zoomLabel={t`Magnify board`}
      fitLabel={t`Fit board`}
    >
      <CellGridBoard
        boardTheme="quoridor"
        fill
        label={t`Quoridor board, nine columns and nine rows`}
        describedBy={`${props.testId}-wall-status`}
        testId={props.testId}
        columnLabels={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']}
        rowLabels={['9', '8', '7', '6', '5', '4', '3', '2', '1']}
        cells={props.selection.cells()}
        cellTestId={(cell) =>
          `${props.testId}-action-${cell}${tool() === 'move' ? '' : tool()}`
        }
        onActivate={props.selection.activate}
        onPreview={props.selection.setPreview}
        onCellKey={(key) => {
          if (key !== 'Escape') return false;
          props.selection.cancel();
          return true;
        }}
      />
    </QuoridorSurface>
  );
}

function QuoridorBoardView(props: BoardViewProps): JSX.Element {
  const game = (): Quoridor => props.state.game();
  const tool = (): QuoridorTool => props.state.tool();
  const selection = createBoardSelection(props);
  // Cancel and Place wall leave the page; focus lands on the active tool instead.
  const toolFocus = createFocusTarget();
  const [refocus, setRefocus] = createSignal(false);
  createEffect(
    () => refocus() && toolFocus.mounted(),
    (ready) => {
      if (ready && toolFocus.focus()) setRefocus(false);
    }
  );
  return (
    <StackVertical gap="xs">
      <Show when={game().winner === null && quoridorMustPass(game())}>
        <QuoridorBoardTools
          testId={props.testId}
          actions={props.state.actions()}
        />
      </Show>
      <PlayingSurface {...props} selection={selection} />
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
          focusTarget={toolFocus.target}
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
          cancel={() => {
            selection.cancel();
            setRefocus(true);
          }}
          commit={() => {
            selection.commit();
            setRefocus(true);
          }}
        />
      </Show>
      <QuoridorRefusalToast
        testId={props.testId}
        reason={selection.refusal()}
      />
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
  // Each new position starts a fresh turn with the pawn tool, never a leftover wall tool.
  const [tool, setTool] = createSignal((): QuoridorTool => {
    game();
    return 'move';
  });
  const [refusal, setRefusal] = createSignal(() => {
    game();
    return '';
  });
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
    setTool,
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

/**
 * Place wall and Cancel, under the tools. The board's box may scroll (a
 * phone's fixed view): a wall just proposed brings them into its view.
 */
function WallConfirmation(props: {
  testId: string;
  enabled: boolean;
  cancel: () => void;
  commit: () => void;
}): JSX.Element {
  const reveal = createScrollTarget();
  onSettled(() => {
    reveal.scrollIntoView({
      behavior: 'instant',
      block: 'nearest',
      scope: 'scroller',
    });
  });
  return (
    <StackHorizontal
      gap="sm"
      wrap
      scrollTarget={reveal.target}
      dataSet={{ component: 'QuoridorWallConfirmation' }}
    >
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

/** A refused wall's reason, floated over the command bar until it changes. */
function QuoridorRefusalToast(props: {
  testId: string;
  reason: string;
}): JSX.Element {
  return (
    <ToastStack placement="above-commands">
      <Show when={props.reason !== ''}>
        <Notice
          tone="warning"
          dataSet={{ testid: `${props.testId}-wall-refusal` }}
        >
          {props.reason}
        </Notice>
      </Show>
    </ToastStack>
  );
}

function toolGuidance(tool: QuoridorTool): string {
  if (tool === 'move') return t`Move to a marked square.`;
  return tool === 'h'
    ? t`Tap a square: preview a wall above it.`
    : t`Tap a square: preview a wall to its right.`;
}
