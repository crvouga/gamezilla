/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from './route-stub';

export default function NotFoundStub(): JSX.Element {
  return (
    // Spaces is its parent, so a phone's header has a way back too.
    <RouteStub
      screenId="not-found"
      title={<Trans>Not found</Trans>}
      parent={{ name: <Trans>Spaces</Trans>, href: '/' }}
      notFound
    />
  );
}
