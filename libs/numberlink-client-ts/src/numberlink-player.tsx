import type {
  PuzzlePlayerProps,
  PuzzlePreviewProps,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeNumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-definition';
import { decodeNumberlinkState } from '@libs/numberlink-shared-ts/numberlink-state';
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
  return (
    <StackVertical gap="md">
      <NumberlinkBoard
        definition={props.definition}
        state={drawing.preview()}
        disabled={props.disabled}
        onTraceStart={drawing.begin}
        onTraceMove={drawing.extend}
        onTraceEnd={drawing.finish}
        onTraceCancel={drawing.cancel}
        onActivate={drawing.activate}
        onNavigate={drawing.extend}
        onCellKey={drawing.key}
      />
      <P variant="caption" tone="secondary">
        <Trans>
          Draw from an endpoint to its match. With a keyboard, press Enter to
          start, use arrow keys to draw, then Enter to finish. Escape cancels;
          Delete removes a path.
        </Trans>
      </P>
      <Show when={drawing.error()}>
        {(error) => <Notice tone="error">{error()}</Notice>}
      </Show>
    </StackVertical>
  );
}

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
