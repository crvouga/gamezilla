/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function SpacesStub(): JSX.Element {
  return <RouteStub screenId="spaces" title={<Trans>Spaces</Trans>} />;
}
