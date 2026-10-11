/** @jsxImportSource solid-js */
import {
  COLOR_TONES,
  CONTROL_SIZE_TOKENS,
} from '@pkgs/ui-root-shared/token-names';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { SchemePreview } from './scheme-preview';
import { Sparkline } from './sparkline';
import { StackVertical } from './stack';
import { P } from './text';

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
