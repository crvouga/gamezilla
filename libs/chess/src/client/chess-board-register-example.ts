/**
 * Side-effect module: registers the {@link ChessBoardExample} into the
 * shared UI component explorer registry so it shows up alongside the lib's
 * built-in examples (Button, Modal, etc.).
 *
 * Imported once from the chess settings/developer/ui-components screen so
 * Skia + chess.js stay out of the bundle for users who never open it.
 */

import { registerComponentExample } from '@gamezilla/ui';
import ChessBoardExample from './chess-board.example';

let registered = false;

export function ensureChessBoardExampleRegistered(): void {
  if (registered) return;
  registered = true;
  registerComponentExample({
    name: 'ChessBoard',
    category: 'Games',
    Example: ChessBoardExample,
  });
}
