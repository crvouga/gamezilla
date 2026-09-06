/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Clickable } from './clickable';

export default function ClickableExample(): JSX.Element {
  const [count, setCount] = createSignal(0);

  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover (desktop pointer) + press apply a token-driven tint overlay by default."
      />

      <SchemePreview>
        <Stack spacing={3}>
          <Clickable
            sx={{ p: 4, background: 'surface', borderRadius: 10 }}
            onClick={() => setCount((c) => c + 1)}
          >
            <Text
              variant="body"
              label={`Tint feedback · click count: ${count()}`}
            />
          </Clickable>

          <Clickable
            sx={{ p: 4, background: 'surface', borderRadius: 10 }}
            feedback="opacity"
            onClick={() => setCount(0)}
          >
            <Text variant="body" label="Opacity feedback (legacy)" />
          </Clickable>

          <Clickable
            sx={{ p: 4, background: 'tintSubtle', borderRadius: 10 }}
            feedback="none"
            onClick={() => undefined}
          >
            <Text
              variant="body"
              sx={{ color: 'tint' }}
              label="No feedback (caller handles state)"
            />
          </Clickable>

          <Clickable
            sx={{
              p: 4,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: 'border',
              borderRadius: 10,
            }}
            disabled
          >
            <Text
              variant="body"
              sx={{ color: 'disabled' }}
              label="Disabled clickable"
            />
          </Clickable>
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
