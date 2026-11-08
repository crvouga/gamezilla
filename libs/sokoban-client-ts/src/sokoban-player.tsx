import {
  type PuzzlePlayerProps,
  type PuzzlePreviewProps,
  usePuzzleLibraryNavigation,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  decodeSokobanPosition,
  sokobanComplete,
} from '@libs/sokoban-shared-ts/sokoban-position';
import type {
  SokobanBoard,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { DirectionPad } from '@pkgs/ui-root-client-ts/direction-pad';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';

import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createMemo, createUniqueId, type JSX, Show } from 'solid-js';
import { createSokobanSteering } from './create-sokoban-steering';
import { sokobanPieces, sokobanTiles } from './sokoban-board-view';
import { type SokobanFeedback, SokobanStatus } from './sokoban-feedback';
import { SokobanPlayBoard } from './sokoban-play-board';
import { useSokobanWords } from './use-sokoban-words';

function Steering(props: {
  board: SokobanBoard;
  position: SokobanPosition;
  disabled: boolean;
  onAction: (action: string) => void;
  onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const mode = useLayoutMode();
  const help = createUniqueId();
  const steering = createSokobanSteering({
    board: () => props.board,
    position: () => props.position,
    disabled: () => props.disabled,
    onAction: (action) => props.onAction(action),
  });
  const complete = () => sokobanComplete(props.board, props.position);
  const feedback = (): SokobanFeedback => {
    const refused = steering.refusal();
    if (props.disabled && steering.queueOverflow()) return { kind: 'overflow' };
    if (refused) return { kind: 'refusal', ...refused };
    if (props.disabled) return { kind: 'saving' };
    if (complete()) return { kind: 'solved' };
    return null;
  };
  return (
    <StackVertical gap="md">
      <SokobanPlayBoard
        board={props.board}
        position={props.position}
        describedBy={help}
        onDirection={steering.steer}
        onTile={steering.tap}
      />
      <StackHorizontal gap="md" align="start" justify="between">
        <SokobanStatus
          position={props.position}
          help={help}
          wide={mode() === 'wide'}
          feedback={feedback()}
          onReturnToLibrary={props.onReturnToLibrary}
        />
        {/* Screen width does not tell us whether a keyboard is available. */}
        <DirectionPad
          size="sm"
          layout="arrows"
          labels={{
            up: t`Move up`,
            right: t`Move right`,
            down: t`Move down`,
            left: t`Move left`,
          }}
          // Presses while a move is being kept queue, as keys do.
          disabled={false}
          testId="sokoban-move"
          onDirection={(heading) => steering.steer(heading)}
        />
      </StackHorizontal>
    </StackVertical>
  );
}

/** Push every crate onto a goal, with keyboard and on-screen movement controls. */
export function SokobanPlayer(props: PuzzlePlayerProps): JSX.Element {
  const openLibrary = usePuzzleLibraryNavigation();
  return <SokobanPlayerView {...props} onReturnToLibrary={openLibrary} />;
}

/** Board presentation; navigation is supplied by the production player container. */
export function SokobanPlayerView(
  props: PuzzlePlayerProps & {
    readonly onReturnToLibrary: () => void;
  }
): JSX.Element {
  const { t } = useLingui();
  // Primitive inputs: a re-delivered row with the same text keeps the board.
  const definition = createMemo(() => props.definition);
  const state = createMemo(() => props.state);
  const input = createMemo(() => {
    const board = decodeSokobanBoard(definition());
    if (!board.valid) return null;
    const position = decodeSokobanPosition(board.value, state());
    return position.valid
      ? { board: board.value, position: position.value }
      : null;
  });
  return (
    <Show
      when={input()}
      fallback={
        <Notice tone="error">
          <Trans>
            This puzzle cannot be opened. Choose a saved puzzle from your
            library.
          </Trans>
          <Button
            title={t`Return to puzzles`}
            onClick={props.onReturnToLibrary}
          />
        </Notice>
      }
    >
      {(value) => (
        <Steering
          board={value().board}
          position={value().position}
          disabled={props.disabled}
          onAction={props.onAction}
          onReturnToLibrary={props.onReturnToLibrary}
        />
      )}
    </Show>
  );
}

/** The board as built, pieces where they start; draft boards may be incomplete. */
export function SokobanPreview(props: PuzzlePreviewProps): JSX.Element {
  const { t } = useLingui();
  const words = useSokobanWords();
  const board = createMemo(() => {
    const decoded = decodeSokobanBoard(props.definition);
    return decoded.valid ? decoded.value : null;
  });
  return (
    <Show when={board()}>
      {(value) => {
        const pieces = () => ({
          worker: value().worker,
          crates: value().crates,
        });
        return (
          <TileBoard
            label={t`Sokoban board preview`}
            testId="sokoban-preview"
            columns={value().width}
            rows={value().height}
            tiles={sokobanTiles(value(), pieces(), words)}
            pieces={sokobanPieces(value(), pieces())}
            disabled
          />
        );
      }}
    </Show>
  );
}
