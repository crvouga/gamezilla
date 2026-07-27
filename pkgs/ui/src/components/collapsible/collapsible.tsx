/**
 * `Collapsible` -- expandable disclosure section.
 *
 * Uses a simple chevron character by default. Pass `renderIcon` to customize.
 *
 * @example
 * ```tsx
 * <Collapsible title="More details">
 *   <Text>Hidden content revealed on tap.</Text>
 * </Collapsible>
 * ```
 */

import { type PropsWithChildren, type ReactNode, useState } from 'react';
import { View } from 'react-native';
import {
  componentDataSet,
  type ComponentDataSet,
} from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Text } from '../text';

export type CollapsibleProps = PropsWithChildren<{
  title: string;
  /** Whether the section starts expanded. Defaults to false. */
  defaultOpen?: boolean;
  /** Custom icon renderer. Receives `isOpen` state. */
  renderIcon?: (isOpen: boolean) => ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
}>;

function DefaultIcon({ isOpen }: { isOpen: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.icon,
        fontSize: 16,
        transform: [{ rotate: isOpen ? '90deg' : '0deg' }],
      }}
      label="›"
    />
  );
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  renderIcon,
  dataSet,
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View {...componentDataSet('Collapsible', dataSet)}>
      <Pressable
        onPress={() => setIsOpen((v) => !v)}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          py: 2,
        }}
      >
        {renderIcon ? renderIcon(isOpen) : <DefaultIcon isOpen={isOpen} />}
        <Text variant="bodyBold" label={title} />
      </Pressable>
      {isOpen && <Box sx={{ ml: 6, mb: 2 }}>{children}</Box>}
    </View>
  );
}
