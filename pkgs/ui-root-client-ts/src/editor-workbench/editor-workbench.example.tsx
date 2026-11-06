import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';
import { Surface } from '../surface/index';
import { P } from '../text/index';
import { EditorWorkbench } from './index';

/** A canvas stand-in, a row of tools beside it and a note under them. */
export default function EditorWorkbenchExample(): JSX.Element {
  return (
    <ExampleRoot>
      <EditorWorkbench
        canvas={
          <Surface tone="muted" radius="card" padding="2xl">
            <P align="center">Canvas</P>
          </Surface>
        }
        tools={
          <StackHorizontal gap="sm" wrap>
            <Button title="Wall" intent="neutral" variant="outline" />
            <Button title="Floor" intent="neutral" variant="outline" />
            <Button title="Goal" intent="neutral" variant="outline" />
          </StackHorizontal>
        }
        notes={
          <P variant="caption" tone="secondary">
            Choose a tool, then a square.
          </P>
        }
      />
    </ExampleRoot>
  );
}
