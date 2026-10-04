/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { BrandIcon } from './brand-icon';

export default function BrandIconExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row gap-4 items-center">
        <BrandIcon name="google" size={20} />
        <BrandIcon name="google" size={32} />
        <BrandIcon name="google" size={48} />
      </div>
    </ExampleRoot>
  );
}
