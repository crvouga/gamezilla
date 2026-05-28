import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppHeaderTabs } from '@apps/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@apps/client/ui/use-account-actions';
import { ProfileScreen } from '@libs/profile/client/profile-screen';

export default function ProfileTab() {
  const accountActions = useAccountActions();
  return (
    <ProfileScreen
      accountActions={accountActions}
      leading={<AppHeaderLogo />}
      centerTabs={<AppHeaderTabs />}
      headerEnd={<AppAccountMenu />}
    />
  );
}
