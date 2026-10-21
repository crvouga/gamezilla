/** @jsxImportSource solid-js */
import { createSignal, For, type JSX } from 'solid-js';
import { ArrowKeyGroup } from './arrow-key-group';
import { Button } from './button';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { StackHorizontal } from './stack';
import { P } from './text';

const STEPS = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] as const;

export default function ArrowKeyGroupExample(): JSX.Element {
  const [shown, setShown] = createSignal(0);
  const back = (): void => {
    setShown((step) => Math.max(0, step - 1));
  };
  const forward = (): void => {
    setShown((step) => Math.min(STEPS.length, step + 1));
  };
  return (
    <ExampleRoot>
      <ExampleSection title="Focus the group, then press the left and right arrows">
        <ArrowKeyGroup
          aria-label="Moves. The left and right arrow keys step through them."
          onPrevious={back}
          onNext={forward}
        >
          <StackHorizontal wrap gap="xs">
            <For each={STEPS}>
              {(step, index) => (
                <Button
                  title={step}
                  size="sm"
                  intent="neutral"
                  variant={shown() === index() + 1 ? 'solid' : 'ghost'}
                  onClick={() => setShown(index() + 1)}
                />
              )}
            </For>
          </StackHorizontal>
          <P variant="caption" tone="secondary">
            {`Showing ${String(shown())} of ${String(STEPS.length)}`}
          </P>
        </ArrowKeyGroup>
      </ExampleSection>
    </ExampleRoot>
  );
}
