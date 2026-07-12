import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { SearchScreen } from '@libs/search/client/search-screen';

export default function SearchTab() {
  return (
    <SearchScreen
      accountMenu={<AppAccountMenu />}
      leading={<AppHeaderLogo />}
    />
  );
}
