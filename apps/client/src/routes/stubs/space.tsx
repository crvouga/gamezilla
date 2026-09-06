/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { RouteStub } from '../route-stub';

export default function SpaceStub(): JSX.Element {
  return (
    <RouteStub
      screenId="space"
      title={<Trans>Space</Trans>}
      parent={{ name: <Trans>Spaces</Trans>, href: '/' }}
    />
  );
}
