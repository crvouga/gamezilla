import { BottomActionBar } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import {
  buildChessPuzzleActionBarItems,
  type ChessPuzzleActionBarModel,
} from './chess-puzzle-action-bar-items';

export type ChessPuzzleActionBarProps = ChessPuzzleActionBarModel;

export function ChessPuzzleActionBar(
  props: ChessPuzzleActionBarProps
): JSX.Element {
  return <BottomActionBar items={buildChessPuzzleActionBarItems(props)} />;
}
