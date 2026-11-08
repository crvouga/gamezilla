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
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { createMemo, createUniqueId, type JSX, Show } from 'solid-js';
import { createSokobanSteering } from './create-sokoban-steering';
import { sokobanPieces, sokobanTiles } from './sokoban-board-view';
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
  const words = useSokobanWords();
  const mode = useLayoutMode();
  const help = createUniqueId();
  const steering = createSokobanSteering({
    board: () => props.board,
    position: () => props.position,
    disabled: () => props.disabled,
    onAction: (action) => props.onAction(action),
  });
  const complete = () => sokobanComplete(props.board, props.position);
  const wide = () => mode() === 'wide';
  return (
    <StackVertical gap="md">
      <SokobanPlayBoard
        board={props.board}
        position={props.position}
        describedBy={help}
        onDirection={steering.steer}
        onTile={steering.tap}
      />
      <Show when={complete()}>
        <Notice tone="success" dataSet={{ testid: 'sokoban-solved' }}>
          <P role="status" variant="bodyBold">
            <Trans>All crates are on goals</Trans>
          </P>
          <P variant="caption">
            <Trans>Keep playing or choose another puzzle.</Trans>
          </P>
          <Button
            title={t`Choose another puzzle`}
            onClick={props.onReturnToLibrary}
          />
        </Notice>
      </Show>
      {/* How to move and how far, beside the movement pad on a phone, so
          the board, the pad and the attempt's undo stay on one screen. */}
      <StackHorizontal gap="md" align="center" justify="between">
        <StackVertical gap="xs" shrink>
          <P
            role="status"
            variant="label"
            dataSet={{
              testid: 'sokoban-counts',
              moves: String(props.position.moves),
              pushes: String(props.position.pushes),
            }}
          >
            {t`Moves ${props.position.moves} · Pushes ${props.position.pushes}`}
          </P>
          <P id={help} variant="caption" tone="secondary">
            <Show
              when={wide()}
              fallback={
                <Trans>Swipe, tap beside the worker, or use the pad.</Trans>
              }
            >
              <Trans>
                Move with the arrow keys or W A S D, or click a square beside
                the worker.
              </Trans>
            </Show>
          </P>
        </StackVertical>
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
      <Show when={props.disabled}>
        <P
          role="status"
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'sokoban-saving' }}
        >
          <Show
            when={steering.queueOverflow()}
            fallback={
              <Trans>Keeping your move. Up to four directions can wait.</Trans>
            }
          >
            <Trans>
              Direction not added. Four directions are already waiting.
            </Trans>
          </Show>
        </P>
      </Show>
      <Show when={steering.refusal()}>
        {(refused) => (
          <Notice
            tone="warning"
            dataSet={{ testid: 'sokoban-refusal', code: refused().code }}
          >
            {words.refusal(refused().code, refused().message)}
            <P variant="caption">
              <Trans>Try another direction.</Trans>
            </P>
          </Notice>
        )}
      </Show>
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
