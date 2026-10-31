/** @jsxImportSource solid-js */

import type {
  Align,
  Justify,
  MinHeight,
  SelfAlign,
} from '@pkgs/ui-root-client-ts/layout-props';
import {
  Stack,
  StackHorizontal,
  StackVertical,
} from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { SPACE_TOKENS } from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import {
  ExampleSection,
  ExampleTile,
} from '../../storybook/fixtures/example-section';

const ALIGNS: readonly Align[] = [
  'start',
  'center',
  'end',
  'stretch',
  'baseline',
];
const JUSTIFIES: readonly Justify[] = [
  'start',
  'center',
  'end',
  'between',
  'around',
  'evenly',
];
const SELVES: readonly SelfAlign[] = [
  'auto',
  'start',
  'center',
  'end',
  'stretch',
];
const MIN_HEIGHTS: readonly MinHeight[] = ['none', 'control', 'row'];
const MAX_WIDTHS = ['form', 'prose', 'content', 'wide', 'full'] as const;

function Tiles(): JSX.Element {
  return (
    <>
      <ExampleTile label="One" />
      <ExampleTile label="Two" tall />
      <ExampleTile label="Three" />
    </>
  );
}

function Directions(): JSX.Element {
  return (
    <>
      <ExampleSection title="StackVertical">
        <StackVertical gap="sm">
          <Tiles />
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="StackHorizontal">
        <StackHorizontal gap="sm">
          <Tiles />
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="Stack: vertical, horizontal from md; gap sm, xl from lg">
        <Stack
          direction={{ base: 'vertical', md: 'horizontal' }}
          gap={{ base: 'sm', lg: 'xl' }}
        >
          <Tiles />
        </Stack>
      </ExampleSection>
    </>
  );
}

function Spacing(): JSX.Element {
  return (
    <>
      <For each={SPACE_TOKENS}>
        {(token) => (
          <ExampleSection title={`gap ${token}`}>
            <StackHorizontal gap={token}>
              <Tiles />
            </StackHorizontal>
          </ExampleSection>
        )}
      </For>
      <For each={SPACE_TOKENS}>
        {(token) => (
          <ExampleSection title={`padding ${token}`}>
            <Surface tone="muted" radius="control" padding={token}>
              <ExampleTile label="Content" />
            </Surface>
          </ExampleSection>
        )}
      </For>
      <ExampleSection title="paddingX lg, paddingY xs">
        <Surface tone="muted" radius="control" paddingX="lg" paddingY="xs">
          <ExampleTile label="Content" />
        </Surface>
      </ExampleSection>
      <ExampleSection title="paddingTop xl, paddingBottom xs, paddingStart 2xl, paddingEnd sm">
        <Surface
          tone="muted"
          radius="control"
          paddingTop="xl"
          paddingBottom="xs"
          paddingStart="2xl"
          paddingEnd="sm"
        >
          <ExampleTile label="Content" />
        </Surface>
      </ExampleSection>
      <ExampleSection title="padding sm, lg from md">
        <Surface
          tone="muted"
          radius="control"
          padding={{ base: 'sm', md: 'lg' }}
        >
          <ExampleTile label="Content" />
        </Surface>
      </ExampleSection>
    </>
  );
}

function Alignment(): JSX.Element {
  return (
    <>
      <For each={ALIGNS}>
        {(align) => (
          <ExampleSection title={`align ${align}`}>
            <StackHorizontal gap="sm" align={align}>
              <Tiles />
            </StackHorizontal>
          </ExampleSection>
        )}
      </For>
      <For each={JUSTIFIES}>
        {(justify) => (
          <ExampleSection title={`justify ${justify}`}>
            <StackHorizontal gap="sm" justify={justify}>
              <Tiles />
            </StackHorizontal>
          </ExampleSection>
        )}
      </For>
      <ExampleSection title="centered: align center, justify center, minHeight row">
        <Surface tone="muted" radius="control">
          <StackVertical align="center" justify="center" minHeight="row">
            <ExampleTile label="Centered" />
          </StackVertical>
        </Surface>
      </ExampleSection>
      <For each={SELVES}>
        {(self) => (
          <ExampleSection title={`self ${self}`}>
            <StackVertical gap="xs">
              <ExampleTile label="Sibling" />
              <StackVertical self={self}>
                <ExampleTile label={self} />
              </StackVertical>
            </StackVertical>
          </ExampleSection>
        )}
      </For>
    </>
  );
}

function Sizing(): JSX.Element {
  return (
    <>
      <ExampleSection title="grow: the middle box takes the leftover room">
        <StackHorizontal gap="sm">
          <ExampleTile label="Fixed" />
          <ExampleTile label="grow" grow />
          <ExampleTile label="Fixed" />
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="shrink: the first box gives up room, the second keeps its size">
        <StackHorizontal gap="sm" width="full" maxWidth="form">
          <StackHorizontal shrink overflow="hidden">
            <ExampleTile label="shrink shrink shrink shrink shrink shrink shrink" />
          </StackHorizontal>
          <ExampleTile label="Keeps its size" />
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="wrap">
        <StackHorizontal gap="sm" wrap width="full" maxWidth="form">
          <For each={SPACE_TOKENS}>
            {(token) => <ExampleTile label={`Item ${token}`} />}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <For each={MAX_WIDTHS}>
        {(measure) => (
          <ExampleSection title={`width full, maxWidth ${measure}`}>
            <StackVertical width="full" maxWidth={measure}>
              <ExampleTile label={measure} />
            </StackVertical>
          </ExampleSection>
        )}
      </For>
      <For each={MIN_HEIGHTS}>
        {(floor) => (
          <ExampleSection title={`minHeight ${floor}`}>
            <Surface tone="muted" radius="control">
              <StackHorizontal minHeight={floor} align="center" paddingX="sm">
                <ExampleTile label={floor} />
              </StackHorizontal>
            </Surface>
          </ExampleSection>
        )}
      </For>
      <ExampleSection title="hidden: the second box renders nothing">
        <StackHorizontal gap="sm">
          <ExampleTile label="Shown" />
          <StackHorizontal hidden>
            <ExampleTile label="Hidden" />
          </StackHorizontal>
        </StackHorizontal>
      </ExampleSection>
    </>
  );
}

export default function StackExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Directions />
      <Spacing />
      <Alignment />
      <Sizing />
    </ExampleRoot>
  );
}
