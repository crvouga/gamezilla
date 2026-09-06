/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function SsoCallbackStub(): JSX.Element {
  return (
    <RouteStub screenId="sso-callback" title={<Trans>Signing in…</Trans>} />
  );
}
