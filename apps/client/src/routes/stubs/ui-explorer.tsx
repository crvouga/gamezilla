/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function UiExplorerStub(): JSX.Element {
  return (
    <RouteStub screenId="ui-explorer" title={<Trans>UI explorer</Trans>} />
  );
}
