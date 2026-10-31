/** @jsxImportSource solid-js */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { Icon } from '@pkgs/ui-root-client-ts/icon';
import { BellIcon, ClockIcon, HeartIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import {
  COLOR_TONES,
  ICON_SIZE_TOKENS,
} from '@pkgs/ui-root-shared-ts/token-names';
import { createSignal, For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const ICONS = [ClockIcon, BellIcon, HeartIcon] as const;

export default function IconExample(): JSX.Element {
  const [index, setIndex] = createSignal(0);
  return (
    <ExampleRoot>
      <SchemePreview>
        <ExampleSection title="size">
          <StackHorizontal gap="md" align="end">
            <For each={ICON_SIZE_TOKENS}>
              {(size) => (
                <StackVertical gap="xs" align="center">
                  <Icon icon={ClockIcon} size={size} />
                  <Text variant="footnote">{size}</Text>
                </StackVertical>
              )}
            </For>
          </StackHorizontal>
        </ExampleSection>
        <ExampleSection title="tone (unset follows the surface)">
          <StackHorizontal gap="md" wrap>
            <Icon icon={BellIcon} />
            <For each={COLOR_TONES}>
              {(tone) => (
                <StackVertical gap="xs" align="center">
                  <Icon icon={BellIcon} tone={tone} />
                  <Text variant="footnote">{tone}</Text>
                </StackVertical>
              )}
            </For>
          </StackHorizontal>
        </ExampleSection>
        <ExampleSection title="bold, label">
          <StackHorizontal gap="md">
            <Icon icon={HeartIcon} />
            <Icon icon={HeartIcon} bold />
            <Icon icon={HeartIcon} tone="destructive" label="Liked" />
          </StackHorizontal>
        </ExampleSection>
      </SchemePreview>
      <ExampleSection title="an icon held in a value follows the value">
        <StackHorizontal gap="md" align="center">
          <Icon icon={ICONS[index()] ?? ClockIcon} size="xl" tone="tint" />
          <Button
            title="Next icon"
            intent="neutral"
            variant="outline"
            size="sm"
            onClick={() => setIndex((at) => (at + 1) % ICONS.length)}
          />
        </StackHorizontal>
      </ExampleSection>
    </ExampleRoot>
  );
}
