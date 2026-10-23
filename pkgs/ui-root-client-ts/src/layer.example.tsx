/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection, ExampleTile } from './example-section';
import { Layer } from './layer';
import { Surface } from './surface';
import { P } from './text';

function Stage(props: { children: JSX.Element }): JSX.Element {
  return (
    <Surface tone="muted" radius="card" padding="xl" minHeight="row" gap="sm">
      <P variant="caption">{'Content underneath'}</P>
      <P variant="caption">{'More content underneath'}</P>
      {props.children}
    </Surface>
  );
}

export default function LayerExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="inset parent, centered">
        <Stage>
          <Layer inset="parent" align="center" justify="center">
            <ExampleTile label="Centered" />
          </Layer>
        </Stage>
      </ExampleSection>
      <ExampleSection title="inset parent, end / end with padding, passThrough">
        <Stage>
          <Layer
            inset="parent"
            align="end"
            justify="end"
            padding="sm"
            passThrough
          >
            <ExampleTile label="Corner" />
          </Layer>
        </Stage>
      </ExampleSection>
      <ExampleSection title="Horizontal, raised, start / between">
        <Stage>
          <Layer
            inset="parent"
            direction="horizontal"
            justify="between"
            align="start"
            padding="sm"
            z="raised"
            passThrough
          >
            <ExampleTile label="Start" />
            <ExampleTile label="End" />
          </Layer>
        </Stage>
      </ExampleSection>
    </ExampleRoot>
  );
}
