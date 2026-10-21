import SearchScreen from './search';
/** @jsxImportSource solid-js */
/** What search contributes to a client app: the Search tab and its screen. */

import { defineSubClient } from '@libs/sub-client-ts/client';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { SearchIcon } from '@pkgs/ui-root-client-ts/icons';

/** Read inside the tab memo, so the label follows the active locale. */
function searchTabLabel(): string {
  const { t } = useLingui();
  return t`Search`;
}

export const SEARCH_CLIENT = defineSubClient({
  name: 'search',
  routes: [{ path: '/search', tab: true, component: SearchScreen }],
  tabs: [
    {
      name: 'Search',
      href: '/search',
      order: 1,
      label: searchTabLabel,
      Icon: SearchIcon,
      testID: Handles.tabSearch,
    },
  ],
});
