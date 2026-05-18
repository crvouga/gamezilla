import { AppAccountMenu } from '@gamezilla/client/ui/app-header/app-account-menu';
import { AppHeaderTabs } from '@gamezilla/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import { SpacesScreen } from '@gamezilla/spaces/client/spaces-screen';

export default function SpacesTab() {
  const accountActions = useAccountActions();
  return (
    <SpacesScreen
      accountActions={accountActions}
      centerTabs={<AppHeaderTabs />}
      headerEnd={<AppAccountMenu />}
    />
  );
}
