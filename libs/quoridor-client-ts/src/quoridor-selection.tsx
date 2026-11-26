import {
  type Quoridor,
  quoridorMustPass,
  wallRefusal,
} from '@libs/quoridor-shared-ts/quoridor';
import { t } from '@lingui/core/macro';
import type { GameFrameAction } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import {
  type QuoridorTool,
  quoridorBoardCells,
  quoridorBoundary,
  quoridorPlayerName,
  quoridorWallMessage,
  withWallPreview,
} from './quoridor-board-cells';

type BoardState = {
  readonly game: Accessor<Quoridor>;
  readonly tool: Accessor<QuoridorTool>;
  readonly refusal: Accessor<string>;
  readonly actions: Accessor<readonly GameFrameAction[]>;
  readonly setRefusal: (message: string) => void;
  readonly setTool: (tool: QuoridorTool) => void;
};

export type BoardViewProps = GameBoardProps & { readonly state: BoardState };

/**
 * Why the chosen wall, or the host, refused the last attempt (`''` for
 * nothing refused): an alert over the screen, so the board and its tools
 * never move for it.
 */
function refusalReason(props: BoardViewProps, wall: string | null): string {
  const game = props.state.game();
  const reason = wall === null ? null : wallRefusal(game, wall);
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

function createWallProposal(props: BoardViewProps) {
  const tool = (): QuoridorTool => props.state.tool();
  const [preview, setPreview] = createSignal<string | null>(null);
  const [directPreview, setDirectPreview] = createSignal<string | null>(null);
  const [chosen, setChosen] = createSignal<{
    wall: string;
    position: string;
  } | null>(null);
  const cancel = () => {
    setChosen(null);
    setDirectPreview(null);
    setPreview(null);
  };
  createEffect(
    () => [props.position, props.syncKey, props.interactive] as const,
    cancel
  );
  createEffect(
    () => tool() === 'move',
    (moving) => {
      if (moving) cancel();
    }
  );
  const selected = () => {
    const value = chosen();
    if (!props.interactive || value?.position !== props.position) return null;
    return tool() === 'move' ? value.wall : value.wall.slice(0, 2) + tool();
  };
  const previewAction = () => {
    if (!props.interactive) return null;
    const cell = preview();
    return (
      directPreview() ??
      selected() ??
      (tool() === 'move' || cell === null ? null : cell + tool())
    );
  };
  return {
    previewAction,
    selected,
    setPreview,
    setDirectPreview,
    setChosen,
    cancel,
  };
}

export function createBoardSelection(props: BoardViewProps) {
  const game = props.state.game;
  const tool = props.state.tool;
  const {
    previewAction,
    selected,
    setPreview,
    setDirectPreview,
    setChosen,
    cancel,
  } = createWallProposal(props);
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
      setChosen({ wall: action, position: props.position });
      return;
    }
    props.state.setRefusal('');
    cancel();
    props.onAction(action);
  };
  const commit = () => {
    const action = selected();
    if (action === null || wallRefusal(game(), action) !== null) return;
    cancel();
    props.state.setRefusal('');
    // The wall is spent: the next turn starts with the pawn tool.
    props.state.setTool('move');
    props.onAction(action);
  };
  const chooseWall = (wall: string) => {
    if (selected() === wall) commit();
    else {
      props.state.setRefusal('');
      setChosen({ wall, position: props.position });
    }
  };
  const refusal = () => refusalReason(props, selected());
  return {
    cells,
    selected,
    message,
    refusal,
    activate,
    setPreview,
    setDirectPreview,
    chooseWall,
    cancel,
    commit,
  };
}
