/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { IconLink } from './icon-link';
import { ChevronLeftIcon, HouseIcon } from './icons';

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
