/** @jsxImportSource solid-js */

import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import {
  RADIUS_TOKENS,
  SURFACE_TONES,
} from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

function Tones(): JSX.Element {
  return (
    <ExampleSection title="tone">
      <Grid columns={{ base: 2, md: 3 }} gap="sm">
        <For each={SURFACE_TONES}>
          {(tone) => (
            <Surface tone={tone} radius="control" border padding="md">
              <P variant="caption" tone="default">
                {tone}
              </P>
            </Surface>
          )}
        </For>
      </Grid>
    </ExampleSection>
  );
}

function Radii(): JSX.Element {
  return (
    <ExampleSection title="radius">
      <StackHorizontal gap="sm" wrap>
        <For each={RADIUS_TOKENS}>
          {(radius) => (
            <Surface tone="muted" radius={radius} paddingX="lg" paddingY="md">
              <Text variant="caption" tone="default">
                {radius}
              </Text>
            </Surface>
          )}
        </For>
      </StackHorizontal>
    </ExampleSection>
  );
}

function Recipes(): JSX.Element {
  return (
    <>
      <ExampleSection title="border">
        <Surface tone="background" radius="card" border padding="lg" gap="xs">
          <P variant="label">{'A bordered surface'}</P>
          <P variant="caption">{'Hairline in the border color.'}</P>
        </Surface>
      </ExampleSection>
      <ExampleSection title="hierarchy: canvas (background), raised (surface), sunken (muted)">
        <Surface tone="background" radius="card" border padding="lg" gap="md">
          <P variant="caption">{'Canvas: the page itself'}</P>
          <Surface tone="surface" radius="card" border padding="lg" gap="sm">
            <P variant="label">{'Raised: cards, lists, sheets, menus'}</P>
            <Surface
              tone="muted"
              radius="control"
              direction="horizontal"
              align="center"
              gap="xs"
              paddingX="md"
              paddingY="sm"
            >
              <Text variant="caption">
                {'Sunken: inputs, wells, inactive stat pills'}
              </Text>
            </Surface>
          </Surface>
        </Surface>
      </ExampleSection>
      <ExampleSection title="overflow hidden clips content to the radius">
        <Surface tone="muted" radius="card" overflow="hidden">
          <Surface tone="tint-subtle" padding="lg">
            <P variant="caption">{'Clipped by the parent radius'}</P>
          </Surface>
        </Surface>
      </ExampleSection>
    </>
  );
}

export default function SurfaceExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <Tones />
        <Radii />
        <Recipes />
      </SchemePreview>
    </ExampleRoot>
  );
}
