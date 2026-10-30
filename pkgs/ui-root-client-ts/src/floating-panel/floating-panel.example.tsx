/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { CloseIconButton } from '@pkgs/ui-root-client-ts/close-icon-button';
import {
  FloatingPanel,
  FloatingPanelHeader,
} from '@pkgs/ui-root-client-ts/floating-panel';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function FloatingPanelExample(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [recording, setRecording] = createSignal(false);
  return (
    <ExampleRoot>
      <ExampleSection title="A window over the page (bottom-end corner)">
        <StackVertical gap="sm" align="start">
          <Button title="Open window" onClick={() => setOpen(true)} />
          <Button
            title="Show recording control"
            variant="outline"
            onClick={() => setRecording(true)}
          />
        </StackVertical>
        <Show when={open()}>
          <FloatingPanel
            label="Feedback"
            size="window"
            header={
              <FloatingPanelHeader
                title="Feedback"
                handleLabel="Feedback window"
                trailing={<CloseIconButton onClick={() => setOpen(false)} />}
              />
            }
          >
            <StackVertical padding="lg">
              <P>{'The page behind stays usable.'}</P>
            </StackVertical>
          </FloatingPanel>
        </Show>
        <Show when={recording()}>
          <FloatingPanel label="Recording" role="region">
            <P variant="caption" role="status">
              {'Recording…'}
            </P>
            <Button
              title="Stop"
              size="sm"
              onClick={() => setRecording(false)}
            />
          </FloatingPanel>
        </Show>
      </ExampleSection>
    </ExampleRoot>
  );
}
