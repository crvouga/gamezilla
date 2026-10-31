import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, For } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function PaddleCourtExample() {
  const [height, setHeight] = createSignal(400);
  return (
    <ExampleRoot>
      <StackVertical gap="lg">
        <P id="court-example-help">
          Focus the court. Move with the arrow keys or drag. The second court is
          read-only.
        </P>
        <For each={[true, false]}>
          {(enabled) => (
            <PaddleCourt
              width={1200}
              height={800}
              controlled={enabled ? ['first'] : []}
              enabled={enabled}
              label={enabled ? 'Interactive court' : 'Spectator court'}
              instructionsId="court-example-help"
              testId={`court-example-${enabled}`}
              paddles={[
                { side: 'first', x: 64, y: height(), width: 20, height: 144 },
                { side: 'second', x: 1136, y: 400, width: 20, height: 144 },
              ]}
              ball={{ x: 700, y: 300, size: 20 }}
              onDirection={(_side, direction) =>
                setHeight((y) =>
                  Math.max(72, Math.min(728, y + direction * 20))
                )
              }
              onTarget={(_side, target) =>
                setHeight(Math.max(72, Math.min(728, target * 800)))
              }
              onRelease={() => undefined}
            />
          )}
        </For>
      </StackVertical>
    </ExampleRoot>
  );
}
