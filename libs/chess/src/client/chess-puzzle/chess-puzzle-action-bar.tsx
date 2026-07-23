import { BottomActionBar } from '@pkgs/ui';
import type { ReactNode } from 'react';

import {
  buildChessPuzzleActionBarItems,
  type ChessPuzzleActionBarModel,
} from './chess-puzzle-action-bar-items';

export type ChessPuzzleActionBarProps = ChessPuzzleActionBarModel;

export function ChessPuzzleActionBar(
  props: ChessPuzzleActionBarProps
): ReactNode {
  return <BottomActionBar items={buildChessPuzzleActionBarItems(props)} />;
}
