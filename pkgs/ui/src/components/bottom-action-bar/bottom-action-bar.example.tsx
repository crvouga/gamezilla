import type { ReactNode } from 'react';

import { Box } from '../box';
import { SchemePreview } from '../explorer/scheme-preview';
import {
  ChevronRightIcon,
  LightbulbIcon,
  LogOutIcon,
  SettingsIcon,
  ShareIcon,
} from '../icons';
import { Text } from '../text';
import { BottomActionBar } from './bottom-action-bar';
import type { BottomActionBarItem } from './bottom-action-bar-types';

const ACTIONS_ONLY: BottomActionBarItem[] = [
  {
    type: 'action',
    id: 'hint',
    label: 'Hint',
    icon: LightbulbIcon,
    onPress: () => {},
  },
  {
    type: 'action',
    id: 'retry',
    label: 'Retry',
    icon: LogOutIcon,
    onPress: () => {},
  },
  {
    type: 'action',
    id: 'share',
    label: 'Share',
    icon: ShareIcon,
    onPress: () => {},
  },
  {
    type: 'action',
    id: 'settings',
    label: 'Settings',
    icon: SettingsIcon,
    onPress: () => {},
    selected: true,
  },
];

const MIXED: BottomActionBarItem[] = [
  {
    type: 'action',
    id: 'hint',
    label: 'Hint',
    icon: LightbulbIcon,
    onPress: () => {},
  },
  {
    type: 'action',
    id: 'retry',
    label: 'Retry',
    icon: LogOutIcon,
    onPress: () => {},
  },
  {
    type: 'button',
    id: 'next',
    title: 'Next',
    endIcon: <ChevronRightIcon size={18} />,
    onPress: () => {},
  },
];

const BUTTONS_ONLY: BottomActionBarItem[] = [
  {
    type: 'button',
    id: 'cancel',
    title: 'Cancel',
    intent: 'neutral',
    variant: 'outline',
    onPress: () => {},
  },
  {
    type: 'button',
    id: 'confirm',
    title: 'Confirm',
    onPress: () => {},
  },
];

export default function BottomActionBarExample(): ReactNode {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="BottomActionBar" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Chess.com-style play chrome. Mix labeled icon tabs with solid buttons."
      />
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Actions only" />
      <SchemePreview>
        <BottomActionBar items={ACTIONS_ONLY} />
      </SchemePreview>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Mixed" />
      <SchemePreview>
        <BottomActionBar items={MIXED} />
      </SchemePreview>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Buttons only"
      />
      <SchemePreview>
        <BottomActionBar items={BUTTONS_ONLY} />
      </SchemePreview>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="Unelevated"
      />
      <SchemePreview>
        <BottomActionBar items={MIXED} elevated={false} />
      </SchemePreview>
    </Box>
  );
}
