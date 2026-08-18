/**
 * Side-effect module: registers the {@link ChessBoardExample} into the
 * shared UI component explorer registry so it shows up alongside the lib's
 * built-in examples (Button, Modal, etc.) for the global UI explorer.
 *
 * Also exports {@link CHESS_COMPONENT_ENTRIES} as the canonical list of
 * chess-owned explorer entries — passed to `ExplorerList` / `ExplorerDetail`
 * inside the chess settings screens so that view shows ONLY chess
 * components, not every UI primitive.
 *
 * Imported once from the chess settings/developer/ui-components screen so
 * Skia + chess.js stay out of the bundle for users who never open it.
 */

import ChessBoardExample from '@pkgs/chess-board/chess-board.example';
import { type ComponentEntry, registerComponentExample } from '@pkgs/ui';

export const CHESS_COMPONENT_ENTRIES: readonly ComponentEntry[] = [
  { name: 'ChessBoard', category: 'Games', Example: ChessBoardExample },
];

let registered = false;

export function ensureChessBoardExampleRegistered(): void {
  if (registered) return;
  registered = true;
  for (const entry of CHESS_COMPONENT_ENTRIES) {
    registerComponentExample(entry);
  }
}
