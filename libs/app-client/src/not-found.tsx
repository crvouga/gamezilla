/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from './route-stub';

export default function NotFoundStub(): JSX.Element {
  return (
    <RouteStub screenId="not-found" title={<Trans>Not found</Trans>} notFound />
  );
}
