/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { EmbeddedFrame } from './embedded-frame';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Pane } from './pane';
import { StackHorizontal, StackVertical } from './stack';
import { P } from './text';

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
