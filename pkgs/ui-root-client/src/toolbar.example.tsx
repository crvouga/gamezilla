/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { IconButton } from './icon-button';
import { PlayIcon, PlusIcon } from './icons';
import { StackHorizontal } from './stack';
import { Surface } from './surface';
import { P } from './text';
import { Toolbar } from './toolbar';

function Actions(): JSX.Element {
  return (
    <>
      <IconButton label="Run all" size={28}>
        <PlayIcon size={14} />
      </IconButton>
      <IconButton label="Add cell" size={28}>
        <PlusIcon size={14} />
      </IconButton>
    </>
  );
}

export default function ToolbarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Compact, muted, above its pane">
        <Surface border radius="card" overflow="hidden">
          <Toolbar aria-label="Notebook">
            <StackHorizontal grow>
              <P variant="footnote" lines={1}>
                {'SQL notebook · sqlite'}
              </P>
            </StackHorizontal>
            <Actions />
          </Toolbar>
          <Surface padding="lg">
            <P variant="caption">{'Pane content'}</P>
          </Surface>
        </Surface>
      </ExampleSection>
      <ExampleSection title="Regular, surface tone, hairline on top">
        <Surface border radius="card" overflow="hidden">
          <Surface padding="lg">
            <P variant="caption">{'Pane content'}</P>
          </Surface>
          <Toolbar edge="top" tone="surface" density="regular" justify="end">
            <Actions />
          </Toolbar>
        </Surface>
      </ExampleSection>
    </ExampleRoot>
  );
}
