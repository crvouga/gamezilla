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
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  Show,
} from 'solid-js';
import type { QuoridorTool } from './quoridor-board-cells';
import {
  QuoridorBoardTools,
  QuoridorTargetPicker,
} from './quoridor-board-tools';
import {
  type BoardViewProps,
  createBoardSelection,
} from './quoridor-selection';
import { createQuoridorTransition } from './quoridor-transition';

const TOOLS: readonly QuoridorTool[] = ['move', 'h', 'v'];

function toolLabel(tool: QuoridorTool): string {
  if (tool === 'move') return t`Move pawn`;
  return tool === 'h' ? t`Horizontal wall` : t`Vertical wall`;
}

function PlayingSurface(
  props: BoardViewProps & {
    precise: boolean;
    selection: ReturnType<typeof createBoardSelection>;
  }
): JSX.Element {
  const game = () => props.state.game();
  const tool = () => props.state.tool();
  const transition = createQuoridorTransition(game);
  return (
    <QuoridorSurface
      revision={props.position}
      syncKey={props.syncKey}
      tool={tool()}
      direct={!props.precise}
      transition={transition().move}
      onWallPreview={props.selection.setDirectPreview}
      onWall={props.selection.chooseWall}
      onIllegalPawn={() => props.state.setRefusal(t`Move to a marked square.`)}
      pawn={quoridorCellName(game().pawns[game().turn] ?? 0)}
      interactive={
        props.interactive && game().winner === null && !quoridorMustPass(game())
      }
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
  const [precise, setPrecise] = createSignal(false);
  // Cancel and Place wall leave the page; focus lands on the active tool instead.
  const toolFocus = createFocusTarget();
  const [refocus, setRefocus] = createSignal(false);
  createEffect(
    () => refocus() && toolFocus.mounted(),
    (ready) => {
      if (ready && toolFocus.focus({ preventScroll: true })) setRefocus(false);
    }
  );
  return (
    <StackVertical gap="xs" dataSet={{ 'quoridor-mode': game().mode }}>
      <Show when={game().winner === null && quoridorMustPass(game())}>
        <QuoridorBoardTools
          testId={props.testId}
          actions={props.state.actions()}
        />
      </Show>
      <PlayingSurface {...props} selection={selection} precise={precise()} />
      <Show
        when={
          props.interactive &&
          game().winner === null &&
          !quoridorMustPass(game())
        }
      >
        <Show
          when={precise()}
          fallback={
            <Button
              title={t`Coordinates`}
              variant="ghost"
              focusTarget={toolFocus.target}
              dataSet={{ testid: `${props.testId}-coordinates` }}
              onClick={() => {
                selection.cancel();
                setPrecise(true);
                setRefocus(true);
              }}
            />
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
            selected={selection.selected()?.slice(0, 2) ?? null}
            onActivate={selection.activate}
            onClose={() => {
              selection.cancel();
              props.state.setTool('move');
              setPrecise(false);
              setRefocus(true);
            }}
          />
        </Show>
      </Show>
      <Show when={selection.selected() !== null && props.interactive}>
        <WallConfirmation
          testId={props.testId}
          enabled={wallRefusal(game(), selection.selected() ?? '') === null}
          reveal={precise()}
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
        {selection.message() ||
          (precise()
            ? toolGuidance(tool())
            : t`Tap a marked square to move or a gap to place a wall.`)}
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
  const state: BoardViewProps['state'] = {
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
  reveal: boolean;
  cancel: () => void;
  commit: () => void;
}): JSX.Element {
  const reveal = createScrollTarget();
  onSettled(() => {
    if (props.reveal)
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
