/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function VisuallyHiddenExample(): JSX.Element {
  const [saves, setSaves] = createSignal(0);
  return (
    <ExampleRoot>
      <ExampleSection title="text only assistive technology reads">
        <P>
          {'3'}
          <VisuallyHidden>{' unread notifications'}</VisuallyHidden>
        </P>
      </ExampleSection>
      <ExampleSection title="a live status announcement">
        <StackHorizontal gap="sm" align="center">
          <Button title="Save" onClick={() => setSaves((n) => n + 1)} />
          <VisuallyHidden role="status" aria-live="polite" aria-atomic>
            {`Saved ${saves()} times`}
          </VisuallyHidden>
        </StackHorizontal>
      </ExampleSection>
    </ExampleRoot>
  );
}
