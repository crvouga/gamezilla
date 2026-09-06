/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function ProfileStub(): JSX.Element {
  return <RouteStub screenId="profile" title={<Trans>Profile</Trans>} />;
}
