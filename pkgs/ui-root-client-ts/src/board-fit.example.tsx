/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { BoardFit } from './board-fit';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { Surface } from './surface';
import { P } from './text';

function ExampleBoard(props: { size: number }): JSX.Element {
  return (
    <Surface
      tone="muted"
      radius="card"
      width="full"
      height="full"
      align="center"
      justify="center"
    >
      <P variant="caption" numeral>{`${props.size} × ${props.size}`}</P>
    </Surface>
  );
}

export default function BoardFitExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="bounded: a review board with its move list">
        <BoardFit
          height="bounded"
          footer={<P variant="caption">{'1. e4 e5 2. Nf3'}</P>}
        >
          {(size) => <ExampleBoard size={size} />}
        </BoardFit>
      </ExampleSection>
    </ExampleRoot>
  );
}
