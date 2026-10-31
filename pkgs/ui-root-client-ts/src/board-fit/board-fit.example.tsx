/** @jsxImportSource solid-js */

import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

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
