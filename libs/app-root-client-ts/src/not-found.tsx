/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from './route-stub';

export default function NotFoundStub(): JSX.Element {
  return (
    // No parent crumb: the address is not inside Spaces, so the header
    // never claims it is. The body's Go to Spaces is the way home on every
    // size.
    <RouteStub
      screenId="not-found"
      title={<Trans>Page not found</Trans>}
      notFound
    />
  );
}
