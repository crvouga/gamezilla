import type {
  PuzzlePlayerProps,
  PuzzlePreviewProps,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeNumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-definition';
import {
  connectedPairs,
  decodeNumberlinkState,
  numberlinkComplete,
} from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';
import { createNumberlinkDrawing } from './create-numberlink-drawing';
import { NumberlinkBoard } from './numberlink-board';
import { NumberlinkDrawingHelp } from './numberlink-drawing-help';
import { NumberlinkRecovery } from './numberlink-recovery';

function Drawing(props: {
  definition: NumberlinkDefinition;
  state: NumberlinkState;
  disabled: boolean;
  onAction: (action: string) => void;
}): JSX.Element {
  const drawing = createNumberlinkDrawing({
    definition: () => props.definition,
    state: () => props.state,
    disabled: () => props.disabled,
    onAction: (action) => props.onAction(JSON.stringify(action)),
  });
  const solved = createMemo(() =>
    numberlinkComplete(props.definition, props.state)
  );
  const drawingLabel = createMemo(() => {
    const id = drawing.gesture()?.pairId;
    return props.definition.pairs.find((pair) => pair.id === id)?.label;
  });
  return (
    <StackVertical gap="sm">
      <NumberlinkBoard
        definition={props.definition}
        state={drawing.preview()}
        drawingPair={drawing.gesture()?.pairId}
        disabled={props.disabled}
        onTraceStart={drawing.begin}
        onTraceMove={drawing.extend}
        onTraceEnd={drawing.finish}
        onTraceCancel={drawing.cancelTrace}
        onActivate={drawing.activate}
        onNavigate={drawing.extend}
        onCellKey={drawing.key}
      />
      <P
        variant="caption"
        aria-live="polite"
        dataSet={{ testid: 'numberlink-progress' }}
      >
        <Trans>Saved:</Trans>{' '}
        <Trans>
          {connectedPairs(props.definition, props.state).length}/
          {props.definition.pairs.length} pairs connected
        </Trans>
        {' — '}
        <Trans>
          {props.state.paths.reduce(
            (count, path) => count + path.cells.length,
            0
          )}
          /{props.definition.width * props.definition.height} cells covered
        </Trans>
      </P>
      {/* After the board, so finishing never moves the board. */}
      <Show when={solved()}>
        <Notice tone="success" dataSet={{ testid: 'numberlink-solved' }}>
          <P variant="bodyBold">
            <Trans>Puzzle solved</Trans>
          </P>
          <P variant="caption">
            <Trans>
              Every pair is connected. Your completed paths are shown above.
            </Trans>
          </P>
        </Notice>
      </Show>
      <Show when={props.disabled && !solved()}>
        <Notice>
          <Trans>
            Drawing is unavailable. You can still inspect the board.
          </Trans>
        </Notice>
      </Show>
      <Show when={!solved() && !props.disabled}>
        <P
          variant="caption"
          tone="secondary"
          aria-live="polite"
          dataSet={{ testid: 'numberlink-drawing-status' }}
        >
          {drawing.feedback() ?? (
            <Show
              when={drawingLabel()}
              fallback={
                <Trans>
                  Drag from an endpoint to its match, or use Enter and arrow
                  keys.
                </Trans>
              }
            >
              {(label) => (
                <Trans>
                  Drawing {label()}. Finish on its matching endpoint to save it.
                </Trans>
              )}
            </Show>
          )}
        </P>
        <NumberlinkRecovery
          definition={props.definition}
          state={props.state}
          onAction={props.onAction}
        />
        <NumberlinkDrawingHelp />
      </Show>
      <Show when={drawing.error()}>
        {(error) => <Notice tone="error">{error()}</Notice>}
      </Show>
    </StackVertical>
  );
}

/** Join matching numbered endpoints while filling the board with paths. */
export function NumberlinkPlayer(props: PuzzlePlayerProps): JSX.Element {
  // SQL watches can deliver new row objects without changing either input.
  // Keep parsing behind primitive equality so that delivery preserves a gesture.
  const definition = createMemo(() => props.definition);
  const serializedState = createMemo(() => props.state);
  const input = createMemo(() => {
    const board = decodeNumberlinkDefinition(definition());
    if (!board.valid) return null;
    const state = decodeNumberlinkState(board.value, serializedState());
    return state.valid ? { definition: board.value, state: state.value } : null;
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
        <Drawing
          definition={value().definition}
          state={value().state}
          disabled={props.disabled}
          onAction={props.onAction}
        />
      )}
    </Show>
  );
}

/** Show the numbered endpoints of a Numberlink puzzle before starting it. */
export function NumberlinkPreview(props: PuzzlePreviewProps): JSX.Element {
  const input = createMemo(() => {
    const board = decodeNumberlinkDefinition(props.definition);
    return board.valid ? board.value : null;
  });
  return (
    <Show when={input()}>
      {(board) => (
        <NumberlinkBoard definition={board()} state={{ paths: [] }} disabled />
      )}
    </Show>
  );
}
