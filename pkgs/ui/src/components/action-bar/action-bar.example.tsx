import { useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { Box } from '../box';
import { CodeIcon, SettingsIcon, UserIcon } from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import { ActionBar, type ActionBarItem } from './action-bar';

const BASE_ITEMS: ActionBarItem[] = [
  {
    id: 'account',
    label: 'Account',
    icon: UserIcon,
    onPress: () => {},
    priority: 3,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    onPress: () => {},
    priority: 2,
  },
  {
    id: 'devtools',
    label: 'Developer tools',
    icon: CodeIcon,
    onPress: () => {},
    priority: 1,
    overflow: 'always',
  },
];

export default function ActionBarExample(): ReactNode {
  const [width, setWidth] = useState(280);

  const items = useMemo(() => BASE_ITEMS, []);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(Math.floor(event.nativeEvent.layout.width));
  };

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="ActionBar" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Drag the handle to shrink the bar and watch actions overflow."
      />
      <Box
        onLayout={onLayout}
        sx={{
          alignSelf: 'stretch',
          borderColor: 'border',
          p: 2,
          alignItems: 'flex-end',
        }}
        style={{ borderWidth: 1, width }}
      >
        <ActionBar items={items} />
      </Box>
      <Stack direction="horizontal" spacing={2} align="center">
        <Text variant="caption" label={`Width: ${width}px`} />
      </Stack>
    </Box>
  );
}
