/** @jsxImportSource solid-js */
/** What search contributes to a client app: the Search tab and its screen. */

import { defineFeatureClient } from '@libs/feature/public/client';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { SearchIcon } from '@pkgs/ui';

/** Read inside the tab memo, so the label follows the active locale. */
function searchTabLabel(): string {
  const { t } = useLingui();
  return t`Search`;
}

export const SEARCH_CLIENT = defineFeatureClient({
  name: 'search',
  routes: [
    { path: '/search', tab: true, load: () => import('./routes/search') },
  ],
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
