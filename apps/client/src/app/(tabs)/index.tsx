import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { SpacesScreen } from '@libs/spaces/client/spaces-screen';

export default function SpacesTab() {
  return (
    <SpacesScreen
      accountMenu={<AppAccountMenu />}
      leading={<AppHeaderLogo />}
    />
  );
}
