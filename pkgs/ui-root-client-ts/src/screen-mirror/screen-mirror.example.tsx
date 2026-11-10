/** @jsxImportSource solid-js */

import { ScreenMirror } from '@pkgs/ui-root-client-ts/screen-mirror';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

/** A small sanitized screen: the kind of markup a watched app sends. */
export const MIRRORED_SCREEN = `<body><main style="padding:16px;font-family:sans-serif">
<h1>Settings</h1>
<p>Theme · System</p>
<p>Language · English</p>
<p>Signed in as [redacted email]</p>
</main></body>`;

/** A screen far longer and wider than the room it is shown in. */
export const LONG_MIRRORED_SCREEN = `<body><main style="padding:16px;font-family:sans-serif">
<h1>People search</h1>
${Array.from({ length: 40 }, (_, index) => `<p>Row ${index + 1} of a long list that keeps going past the bottom of the screen</p>`).join('')}
</main></body>`;

export default function ScreenMirrorExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="A phone screen, scaled to fit">
        <ScreenMirror title="Bob's screen" html={MIRRORED_SCREEN} />
      </ExampleSection>
      <ExampleSection title="A desktop screen">
        <ScreenMirror
          title="Cedar's screen"
          html={MIRRORED_SCREEN}
          device="desktop"
        />
      </ExampleSection>
      <ExampleSection title="Long content stays clipped">
        <ScreenMirror title="Carol's screen" html={LONG_MIRRORED_SCREEN} />
      </ExampleSection>
    </ExampleRoot>
  );
}
