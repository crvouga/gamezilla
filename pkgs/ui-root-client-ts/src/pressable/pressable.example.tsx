/** @jsxImportSource solid-js */

import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { RADIUS_TOKENS } from '@pkgs/ui-root-shared-ts/token-names';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const TABS = ['Play', 'Puzzles', 'Friends'] as const;

function Kinds(): JSX.Element {
  const [count, setCount] = createSignal(0);
  return (
    <>
      <ExampleSection title="button: onPress">
        <Pressable
          onPress={() => setCount((n) => n + 1)}
          direction="horizontal"
          align="center"
          justify="between"
          gap="sm"
          paddingX="lg"
          minHeight="row"
          radius="control"
        >
          <P variant="label">{'Press me'}</P>
          <Text variant="caption" numeral>
            {String(count())}
          </Text>
        </Pressable>
      </ExampleSection>
      <ExampleSection title="link: href, and href with onPress">
        <Pressable href="#games" paddingX="lg" paddingY="md" radius="control">
          <P variant="label">{'A real link'}</P>
        </Pressable>
        <Pressable
          href="#handled"
          onPress={() => setCount((n) => n + 1)}
          paddingX="lg"
          paddingY="md"
          radius="control"
        >
          <P variant="label">{'A link handled in place'}</P>
        </Pressable>
      </ExampleSection>
      <ExampleSection title="tint false, disabled, disabled link">
        <Pressable tint={false} paddingX="lg" paddingY="md" radius="control">
          <P variant="label">{'No tint'}</P>
        </Pressable>
        <Pressable disabled paddingX="lg" paddingY="md" radius="control">
          <P variant="label">{'Disabled'}</P>
        </Pressable>
        <Pressable
          href="#nowhere"
          disabled
          paddingX="lg"
          paddingY="md"
          radius="control"
        >
          <P variant="label">{'Disabled link'}</P>
        </Pressable>
      </ExampleSection>
    </>
  );
}

function States(): JSX.Element {
  const [pressed, setPressed] = createSignal(false);
  const [tab, setTab] = createSignal<(typeof TABS)[number]>('Play');
  return (
    <>
      <ExampleSection title="pressed: a toggle">
        <Pressable
          pressed={pressed()}
          onPress={() => setPressed((on) => !on)}
          radius="full"
          self="start"
        >
          <Surface
            tone={pressed() ? 'tint-subtle' : 'muted'}
            radius="full"
            paddingX="lg"
            paddingY="xs"
          >
            <Text variant="label" tone={pressed() ? 'tint' : 'default'}>
              {pressed() ? 'Following' : 'Follow'}
            </Text>
          </Surface>
        </Pressable>
      </ExampleSection>
      <ExampleSection title="selected: the chosen item of a set">
        <StackHorizontal gap="xs">
          <For each={TABS}>
            {(name) => (
              <Pressable
                selected={tab() === name}
                onPress={() => setTab(name)}
                radius="control"
                grow
              >
                <Surface
                  tone={tab() === name ? 'tint-subtle' : 'transparent'}
                  radius="control"
                  align="center"
                  paddingY="sm"
                >
                  <Text variant="label">{name}</Text>
                </Surface>
              </Pressable>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="current page, aria-expanded with aria-controls and aria-haspopup">
        <Pressable href="#here" current="page" paddingY="sm" radius="control">
          <P variant="label">{'The current page'}</P>
        </Pressable>
        <Pressable
          aria-expanded={pressed()}
          aria-controls="pressable-example-menu"
          aria-haspopup="menu"
          onPress={() => setPressed((on) => !on)}
          paddingY="sm"
          radius="control"
        >
          <P variant="label">{'Opens a menu'}</P>
        </Pressable>
      </ExampleSection>
    </>
  );
}

function Layout(): JSX.Element {
  return (
    <>
      <ExampleSection title="radius: the focus ring and the tint follow it">
        <StackHorizontal gap="sm" wrap>
          <For each={RADIUS_TOKENS}>
            {(radius) => (
              <Pressable radius={radius}>
                <Surface
                  tone="muted"
                  radius={radius}
                  paddingX="lg"
                  paddingY="md"
                >
                  <Text variant="caption" tone="default">
                    {radius}
                  </Text>
                </Surface>
              </Pressable>
            )}
          </For>
        </StackHorizontal>
      </ExampleSection>
      <ExampleSection title="vertical, grow, tabStop false, aria-label">
        <StackHorizontal gap="sm">
          <Pressable grow gap="xs" padding="md" radius="control">
            <P variant="label">{'Vertical'}</P>
            <P variant="caption">{'Two lines, one target'}</P>
          </Pressable>
          <Pressable
            tabStop={false}
            aria-label="Not in the tab order"
            padding="md"
            radius="control"
          >
            <P variant="caption">{'tabStop false'}</P>
          </Pressable>
        </StackHorizontal>
      </ExampleSection>
    </>
  );
}

export default function PressableExample(): JSX.Element {
  return (
    <ExampleRoot>
      <StackVertical gap="lg">
        <Kinds />
        <States />
        <Layout />
      </StackVertical>
    </ExampleRoot>
  );
}
