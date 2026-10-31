/** @jsxImportSource solid-js */

import { IconLink } from '@pkgs/ui-root-client-ts/icon-link';
import { ChevronLeftIcon, HouseIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function IconLinkExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row gap-3 items-center">
        <IconLink href="#previous" label="Back">
          <ChevronLeftIcon size={20} color="text" />
        </IconLink>
        <IconLink href="#home" label="Home" onClick={() => undefined}>
          <HouseIcon size={20} color="text" />
        </IconLink>
      </div>
    </ExampleRoot>
  );
}
