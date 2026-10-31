/** @jsxImportSource solid-js */

import { Sparkline } from '@pkgs/ui-root-client-ts/sparkline';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  COLOR_TONES,
  CONTROL_SIZE_TOKENS,
} from '@pkgs/ui-root-shared-ts/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const RATINGS = [
  1480, 1492, 1487, 1503, 1511, 1498, 1520, 1534, 1529, 1547, 1560, 1552,
] as const;

export default function SparklineExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <For each={CONTROL_SIZE_TOKENS}>
          {(size) => (
            <ExampleSection title={`size ${size}`}>
              <StackVertical width="full" maxWidth="form">
                <Sparkline values={RATINGS} size={size} />
              </StackVertical>
            </ExampleSection>
          )}
        </For>
        <For each={COLOR_TONES}>
          {(tone) => (
            <ExampleSection title={`tone ${tone}`}>
              <StackVertical width="full" maxWidth="form">
                <Sparkline values={RATINGS} tone={tone} size="sm" />
              </StackVertical>
            </ExampleSection>
          )}
        </For>
      </SchemePreview>
      <ExampleSection title="named: an image with an aria-label">
        <StackVertical width="full" maxWidth="form">
          <Sparkline values={RATINGS} aria-label="Rating over 12 games" />
        </StackVertical>
      </ExampleSection>
      <ExampleSection title="a flat series, and fewer than two points (draws nothing)">
        <StackVertical width="full" maxWidth="form" gap="xs">
          <Sparkline values={[5, 5, 5, 5]} size="sm" />
          <Sparkline values={[5]} size="sm" />
          <P variant="caption">{'One point draws no line.'}</P>
        </StackVertical>
      </ExampleSection>
    </ExampleRoot>
  );
}
