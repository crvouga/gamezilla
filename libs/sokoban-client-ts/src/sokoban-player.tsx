import type {
  PuzzlePlayerProps,
  PuzzlePreviewProps,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { decodeSokobanPosition } from '@libs/sokoban-shared-ts/sokoban-position';
import type {
  SokobanBoard,
  SokobanDirection,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
import { createMemo, createUniqueId, For, type JSX, Show } from 'solid-js';
import { createSokobanSteering } from './create-sokoban-steering';
import {
  positionPieces,
  sokobanPieces,
  sokobanTiles,
} from './sokoban-board-view';
import { useSokobanWords } from './use-sokoban-words';

function Steering(props: {
  board: SokobanBoard;
  position: SokobanPosition;
  disabled: boolean;
  onAction: (action: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const words = useSokobanWords();
  const help = createUniqueId();
  const steering = createSokobanSteering({
    board: () => props.board,
    position: () => props.position,
    disabled: () => props.disabled,
    onAction: (action) => props.onAction(action),
  });
  const buttons = (): readonly {
    direction: SokobanDirection;
    title: string;
  }[] => [
    { direction: 'left', title: t`← Left` },
    { direction: 'up', title: t`↑ Up` },
    { direction: 'down', title: t`↓ Down` },
    { direction: 'right', title: t`→ Right` },
  ];
  return (
    <StackVertical gap="md">
      <P
        role="status"
        dataSet={{
          testid: 'sokoban-counts',
          moves: String(props.position.moves),
          pushes: String(props.position.pushes),
        }}
      >
        {t`Moves: ${props.position.moves} · Pushes: ${props.position.pushes}`}
      </P>
      <TileBoard
        label={t`Sokoban board`}
        testId="sokoban-board"
        columns={props.board.width}
        rows={props.board.height}
        tiles={sokobanTiles(props.board, positionPieces(props.position), words)}
        pieces={sokobanPieces(props.board, positionPieces(props.position))}
        describedBy={help}
        onDirection={steering.steer}
        onTile={steering.tap}
      />
      <StackHorizontal gap="sm" wrap>
        <For each={buttons()}>
          {(button) => (
            <Button
              title={button.title}
              intent="neutral"
              variant="outline"
              onClick={() => steering.steer(button.direction)}
              dataSet={{ testid: `sokoban-move-${button.direction}` }}
            />
          )}
        </For>
      </StackHorizontal>
      <P id={help} variant="caption" tone="secondary">
        <Trans>
          Push every crate onto a goal. Use the arrow keys or W A S D on the
          board, swipe, tap a square beside the worker, or use the buttons.
        </Trans>
      </P>
      <Show when={steering.refusal()}>
        {(refused) => (
          <Notice
            tone="warning"
            dataSet={{ testid: 'sokoban-refusal', code: refused().code }}
          >
            {words.refusal(refused().code, refused().message)}
          </Notice>
        )}
      </Show>
    </StackVertical>
  );
}

export function SokobanPlayer(props: PuzzlePlayerProps): JSX.Element {
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
            This puzzle cannot be opened. Return to its overview and choose a
            saved edition.
          </Trans>
        </Notice>
      }
    >
      {(value) => (
        <Steering
          board={value().board}
          position={value().position}
          disabled={props.disabled}
          onAction={props.onAction}
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
