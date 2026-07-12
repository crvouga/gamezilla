import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { InboxScreen } from '@pkgs/inbox/client';

export default function InboxTab() {
  return (
    <InboxScreen
      accountMenu={<AppAccountMenu />}
      leading={<AppHeaderLogo />}
    />
  );
}
