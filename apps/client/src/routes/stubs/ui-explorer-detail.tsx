/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function UiExplorerDetailStub(): JSX.Element {
  return (
    <RouteStub
      screenId="ui-explorer-detail"
      title={<Trans>Component</Trans>}
      parent={{ name: <Trans>UI explorer</Trans>, href: '/ui' }}
    />
  );
}
