/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';

export default function ClickableExample(): JSX.Element {
  const [count, setCount] = createSignal(0);

  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {
          'Hover (desktop pointer) + press apply a token-driven tint overlay by default.'
        }
      </p>

      <SchemePreview>
        <div class="box flex-col gap-3">
          <button
            class="clickable clickableTint p-4 bg-surface rounded-[10px]"
            type="button"
            onClick={() => setCount((c) => c + 1)}
          >
            <p class="text">{`Tint feedback · click count: ${count()}`}</p>
          </button>

          <button
            class="clickable clickableOpacity p-4 bg-surface rounded-[10px]"
            type="button"
            onClick={() => setCount(0)}
          >
            <p class="text">{'Opacity feedback (legacy)'}</p>
          </button>

          <button
            class="clickable p-4 bg-tint-subtle rounded-[10px]"
            type="button"
            onClick={() => undefined}
          >
            <p class="text text-tint">{'No feedback (caller handles state)'}</p>
          </button>

          <button
            class="clickable clickableTint p-4 border border-solid border-border rounded-[10px]"
            type="button"
            disabled
          >
            <p class="text text-disabled">{'Disabled clickable'}</p>
          </button>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
