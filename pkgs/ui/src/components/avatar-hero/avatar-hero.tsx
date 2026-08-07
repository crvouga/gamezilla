/**
 * `AvatarHero` — centered large avatar stage with optional corner action.
 */

import type { LocalizedString } from '@pkgs/i18n';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Center } from '../center';
import { IconButton } from '../icon-button';

export type AvatarHeroAction = {
  onPress: () => void;
  icon: ReactNode;
  accessibilityLabel: LocalizedString;
  disabled?: boolean;
};

export type AvatarHeroProps = {
  /** Diameter of the preview slot in pixels. */
  size: number;
  children: ReactNode;
  action?: AvatarHeroAction;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

const ACTION_SIZE = 44;
const ACTION_INSET = 4;

export function AvatarHero({
  size,
  children,
  action,
  dataSet,
}: AvatarHeroProps) {
  const theme = useTheme();
  const slotSize = size + ACTION_INSET * 2;

  return (
    <Center
      {...componentDataSet('AvatarHero', dataSet)}
      sx={{ py: 2, minHeight: slotSize + 16 }}
    >
      <View style={{ width: slotSize, height: slotSize }}>
        <Center sx={{ width: size, height: size, alignSelf: 'center' }}>
          {children}
        </Center>
        {action !== undefined ? (
          <View
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: ACTION_SIZE / 2,
            }}
          >
            <IconButton
              size={ACTION_SIZE}
              background="surface"
              onPress={action.onPress}
              disabled={action.disabled === true}
              label={action.accessibilityLabel}
              accessibilityLabel={action.accessibilityLabel}
            >
              {action.icon}
            </IconButton>
          </View>
        ) : null}
      </View>
    </Center>
  );
}
