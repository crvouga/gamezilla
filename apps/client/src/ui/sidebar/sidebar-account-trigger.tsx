import { SidebarAccountTriggerAvatar } from '@gamezilla/client/ui/sidebar/sidebar-account-trigger-avatar';
import { SidebarAccountTriggerName } from '@gamezilla/client/ui/sidebar/sidebar-account-trigger-name';
import { Box, IconSymbol, Pressable, useTheme } from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
import { type ElementRef, type ReactNode, type RefObject } from 'react';

export type SidebarAccountTriggerProps = {
  triggerRef: RefObject<ElementRef<typeof Box> | null>;
  open: boolean;
  onPress: () => void;
};

/** Pure layout for the wide-layout sidebar account-menu trigger row. */
export function SidebarAccountTrigger({
  triggerRef,
  open,
  onPress,
}: SidebarAccountTriggerProps): ReactNode {
  const theme = useTheme();
  return (
    <Box ref={triggerRef} collapsable={false} sx={{ alignSelf: 'stretch' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t`User menu`}
        accessibilityState={{ expanded: open }}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          py: 2,
          px: 2,
          borderRadius: 12,
          background: open ? 'surface' : 'transparent',
        }}
      >
        <SidebarAccountTriggerAvatar />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <SidebarAccountTriggerName />
        </Box>
        <IconSymbol name="ellipsis" size={18} color={theme.colors.icon} />
      </Pressable>
    </Box>
  );
}
