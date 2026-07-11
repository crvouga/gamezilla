import { AppHeaderInboxAndAccount } from '@apps/client/ui/app-header/app-header-inbox-and-account';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppHeaderTabs } from '@apps/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@apps/client/ui/use-account-actions';
import { InboxScreen } from '@pkgs/inbox/client';

export default function InboxTab() {
  const accountActions = useAccountActions();
  return (
    <InboxScreen
      accountActions={accountActions}
      leading={<AppHeaderLogo />}
      centerTabs={<AppHeaderTabs />}
      headerEnd={<AppHeaderInboxAndAccount />}
    />
  );
}
