/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ExplorerList } from '@pkgs/ui-client/explorer-list';
import type { JSX } from 'solid-js';

export default function UiExplorerRoute(): JSX.Element {
  return (
    <ExplorerList
      hrefFor={(id) => `/ui/${id}`}
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Components</Trans> },
      ]}
    />
  );
}
