/** @jsxImportSource solid-js */

import { H2 } from '@pkgs/ui-root-client-ts/heading';
import {
  Article,
  Aside,
  Footer,
  Header,
  Main,
  Nav,
  Section,
} from '@pkgs/ui-root-client-ts/landmarks';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

export default function LandmarksExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Header, Nav, Main, Aside, Footer: meaning only, the stacks do the layout">
        <StackVertical gap="sm">
          <Header>
            <ExampleTile label="Header" />
          </Header>
          <Nav aria-label="Sections">
            <StackHorizontal gap="sm">
              <ExampleTile label="Nav item" />
              <ExampleTile label="Nav item" />
            </StackHorizontal>
          </Nav>
          <StackHorizontal gap="sm">
            <Main>
              <ExampleTile label="Main" grow />
            </Main>
            <Aside aria-label="Related">
              <ExampleTile label="Aside" />
            </Aside>
          </StackHorizontal>
          <Footer>
            <ExampleTile label="Footer" />
          </Footer>
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="Section named by its heading">
        <Section aria-labelledby="landmarks-example-friends">
          <StackVertical gap="xs">
            <H2 id="landmarks-example-friends" size="label">
              {'Friends'}
            </H2>
            <P variant="caption">{'A section is a landmark once named.'}</P>
          </StackVertical>
        </Section>
      </ExampleSection>
      <ExampleSection title="Article">
        <Article aria-label="Game summary">
          <StackVertical gap="xs">
            <P variant="label">{'A self-contained item'}</P>
            <P variant="caption">{'It reads on its own, out of context.'}</P>
          </StackVertical>
        </Article>
      </ExampleSection>
    </ExampleRoot>
  );
}
