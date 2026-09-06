/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function SearchStub(): JSX.Element {
  return <RouteStub screenId="search" title={<Trans>Search</Trans>} />;
}
