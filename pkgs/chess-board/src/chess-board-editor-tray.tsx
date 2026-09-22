/** @jsxImportSource solid-js */
/**
 * Board editor chrome: spare piece tray + FEN field. Emits intents; parent
 * owns the position.
 */

import type { PieceCode } from '@pkgs/chess-board-core/types';
import { For, type JSX } from 'solid-js';

import { PIECE_IMAGE_URIS } from './piece-images';

const SPARES: readonly PieceCode[] = [
  'wp',
  'wn',
  'wb',
  'wr',
  'wq',
  'wk',
  'bp',
  'bn',
  'bb',
  'br',
  'bq',
  'bk',
];

export function ChessBoardEditorTray(props: {
  readonly fen: string;
  readonly onFenChange: (fen: string) => void;
  readonly onSpareDragStart: (code: PieceCode) => void;
  readonly onClear: () => void;
  readonly onStartPos: () => void;
}): JSX.Element {
  return (
    <div class="box gap-2">
      <div class="box flex-row gap-1 flex-wrap">
        <For each={[...SPARES]}>
          {(code) => (
            <button
              type="button"
              class="box"
              style={{ width: '36px', height: '36px', padding: '0' }}
              aria-label={`Spare ${code}`}
              onPointerDown={() => props.onSpareDragStart(code)}
            >
              <img src={PIECE_IMAGE_URIS[code]} alt="" width={36} height={36} />
            </button>
          )}
        </For>
      </div>
      <div class="box flex-row gap-2">
        <button type="button" onClick={() => props.onClear()}>
          {'Clear'}
        </button>
        <button type="button" onClick={() => props.onStartPos()}>
          {'Start position'}
        </button>
      </div>
      <label class="box gap-1">
        <span class="text textCaption">{'FEN'}</span>
        <input
          class="box"
          value={props.fen}
          onInput={(e) => props.onFenChange(e.currentTarget.value)}
          aria-label="FEN"
        />
      </label>
    </div>
  );
}
