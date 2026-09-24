/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { GradientBox } from './gradient-box';

export default function GradientBoxExample(): JSX.Element {
  return (
    <ExampleRoot>
      <h3 class="text textHeading text-lg">{'GradientBox'}</h3>

      <p class="text textCaption text-text-secondary">
        {'Default horizontal gradient uses theme tintHover → tintActive.'}
      </p>

      <GradientBox class="p-4 rounded-lg min-h-22 justify-center">
        <p class="text textBodyBold">{'Primary gradient card'}</p>
        <p class="text textCaption mt-1">
          {'Auto contrast-safe text — no hardcoded color'}
        </p>
      </GradientBox>

      <GradientBox
        class="p-4 rounded-md"
        colors={['#4F46E5', '#7C3AED', '#DB2777']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <p class="text textBodyBold">{'Custom stops (diagonal)'}</p>
      </GradientBox>
    </ExampleRoot>
  );
}
