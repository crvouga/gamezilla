/**
 * Contained {@link Button} slot for {@link BottomActionBar}.
 */

import type { ReactNode } from 'react';

import { Box } from '../box';
import { Button } from '../button';
import type { BottomActionBarButtonItem } from './bottom-action-bar-types';

export function BottomActionBarButton(
  item: BottomActionBarButtonItem
): ReactNode {
  return (
    <Box
      sx={{
        flex: item.flex ?? 1,
        alignItems: 'stretch',
        justifyContent: 'center',
        minWidth: 0,
      }}
      {...(item.testID !== undefined ? { testID: item.testID } : {})}
    >
      <Button
        title={item.title}
        onPress={item.onPress}
        intent={item.intent ?? 'primary'}
        variant={item.variant ?? 'solid'}
        flex={1}
        {...(item.disabled !== undefined ? { disabled: item.disabled } : {})}
        {...(item.loading !== undefined ? { loading: item.loading } : {})}
        {...(item.startIcon !== undefined ? { startIcon: item.startIcon } : {})}
        {...(item.endIcon !== undefined ? { endIcon: item.endIcon } : {})}
      />
    </Box>
  );
}
