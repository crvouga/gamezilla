import { MyDisplayName } from '@gamezilla/profile/client/my-display-name';
import type { ReactNode } from 'react';

/** Name slot inside {@link SidebarAccountTrigger}. */
export function SidebarAccountTriggerName(): ReactNode {
  return (
    <MyDisplayName
      variant="bodyBold"
      numberOfLines={1}
      sx={{ color: 'text' }}
    />
  );
}
