import { MyDisplayName } from '@gamezilla/profile/client/my-display-name';
import type { ReactNode } from 'react';

/**
 * Title slot for the floating account menu header. Renders the current
 * user's display name through {@link MyDisplayName}.
 */
export function SidebarAccountMenuHeader(): ReactNode {
  return <MyDisplayName variant="bodyBold" />;
}
