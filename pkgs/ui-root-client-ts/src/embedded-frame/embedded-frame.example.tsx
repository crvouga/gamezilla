/** @jsxImportSource solid-js */

import { EmbeddedFrame } from '@pkgs/ui-root-client-ts/embedded-frame';
import { Pane } from '@pkgs/ui-root-client-ts/pane';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function EmbeddedFrameExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="An in-tree app, filling its pane">
        <StackHorizontal gap="sm" minHeight="row">
          <Pane border>
            <EmbeddedFrame title="Alice's phone">
              <StackVertical grow align="center" justify="center">
                <P variant="caption">{'Embedded app'}</P>
              </StackVertical>
            </EmbeddedFrame>
          </Pane>
          <Pane border>
            <EmbeddedFrame title="Blank document" src="about:blank" />
          </Pane>
        </StackHorizontal>
      </ExampleSection>
    </ExampleRoot>
  );
}
