import { useMemo, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { Box } from '../box';
import { CodeIcon, SettingsIcon, UserIcon } from '../icons';
import { useActionBarChrome } from '../../theme';
import { Stack } from '../stack';
import { Text } from '../text';
import { ActionBar, type ActionBarItem } from './action-bar';

const BASE_ITEMS: ActionBarItem[] = [
  {
    id: 'account',
    label: 'Account',
    shortLabel: 'Account',
    icon: UserIcon,
    onPress: () => {},
    priority: 3,
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: SettingsIcon,
    onPress: () => {},
    priority: 2,
  },
  {
    id: 'devtools',
    label: 'Developer tools',
    icon: CodeIcon,
    onPress: () => {},
    overflow: 'always',
    endsGroup: true,
  },
];

export default function ActionBarExample(): ReactNode {
  const [width, setWidth] = useState(280);
  const chrome = useActionBarChrome();

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
        label="Drag the handle to shrink the bar and watch actions overflow. Dev tools stay in the menu."
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
        <ActionBar
          items={items}
          buttonSize={chrome.buttonSize}
          gap={chrome.gap}
          slotWidth={chrome.slotWidth}
          showInlineLabels={chrome.showInlineLabels}
        />
      </Box>
      <Stack direction="horizontal" spacing={2} align="center">
        <Text variant="caption" label={`Width: ${width}px`} />
      </Stack>
    </Box>
  );
}
