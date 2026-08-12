/**
 * `BottomActionBar` -- chess.com-style play chrome for game screens.
 *
 * Equal-flex row that mixes labeled icon-tab actions with solid contained
 * buttons. Distinct from top {@link ActionBar} (icon overflow chrome).
 *
 * @example
 * ```tsx
 * <BottomActionBar
 *   items={[
 *     { type: 'action', id: 'hint', label: 'Hint', icon: LightbulbIcon, onPress },
 *     { type: 'button', id: 'next', title: 'Next', onPress },
 *   ]}
 * />
 * ```
 */

import type { ReactNode } from 'react';

import { Box } from '../box';
import { BottomActionBarAction } from './bottom-action-bar-action';
import { BottomActionBarButton } from './bottom-action-bar-button';
import type {
  BottomActionBarItem,
  BottomActionBarProps,
} from './bottom-action-bar-types';

const MIN_HEIGHT = 56;

function renderItem(item: BottomActionBarItem): ReactNode {
  if (item.type === 'action') {
    return <BottomActionBarAction key={item.id} {...item} />;
  }
  return <BottomActionBarButton key={item.id} {...item} />;
}

export function BottomActionBar({
  items,
  elevated = true,
  dataSet,
}: BottomActionBarProps): ReactNode {
  return (
    <Box
      dataSet={{ component: 'BottomActionBar', ...dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        gap: 2,
        px: 3,
        minHeight: MIN_HEIGHT,
        ...(elevated
          ? {
              background: 'surface',
              borderColor: 'border',
              borderTopWidth: 1,
            }
          : {}),
      }}
    >
      {items.map(renderItem)}
    </Box>
  );
}

export type {
  BottomActionBarActionItem,
  BottomActionBarButtonItem,
  BottomActionBarItem,
  BottomActionBarProps,
} from './bottom-action-bar-types';
