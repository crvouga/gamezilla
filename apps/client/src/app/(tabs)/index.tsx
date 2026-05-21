import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { AppHeaderTabs } from '@apps/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@apps/client/ui/use-account-actions';
import { SpacesScreen } from '@libs/spaces/client/spaces-screen';

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
