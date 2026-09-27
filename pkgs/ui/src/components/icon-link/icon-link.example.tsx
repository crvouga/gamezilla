/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { ChevronLeftIcon, HouseIcon } from '../icons';
import { IconLink } from './icon-link';

export default function IconLinkExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row gap-3 items-center">
        <IconLink href="#back" label="Back">
          <ChevronLeftIcon size={20} color="text" />
        </IconLink>
        <IconLink href="#home" label="Home" onClick={() => undefined}>
          <HouseIcon size={20} color="text" />
        </IconLink>
      </div>
    </ExampleRoot>
  );
}
