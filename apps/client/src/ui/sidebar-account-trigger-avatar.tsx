import { MyProfileAvatar } from '@gamezilla/client/profile/my-profile-avatar';
import type { ReactNode } from 'react';

/** Avatar slot inside {@link SidebarAccountTrigger}. */
export function SidebarAccountTriggerAvatar(): ReactNode {
  return <MyProfileAvatar size={32} />;
}
