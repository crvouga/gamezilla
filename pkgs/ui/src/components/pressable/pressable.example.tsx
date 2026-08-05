import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Pressable } from './pressable';

export default function PressableExample() {
  const [count, setCount] = useState(0);

  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Hover (desktop pointer) + press apply a token-driven tint overlay by default."
      />

      <SchemePreview>
        <Stack spacing={3}>
          <Pressable
            sx={{ p: 4, background: 'surface', borderRadius: 10 }}
            onPress={() => setCount((c) => c + 1)}
          >
            <Text
              variant="body"
              label={`Tint feedback · tap count: ${count}`}
            />
          </Pressable>

          <Pressable
            sx={{
              p: 4,
              background: 'surface',
              borderRadius: 10,
            }}
            feedback="opacity"
            onPress={() => setCount(0)}
          >
            <Text variant="body" label="Opacity feedback (legacy)" />
          </Pressable>

          <Pressable
            sx={{
              p: 4,
              background: 'tintSubtle',
              borderRadius: 10,
            }}
            feedback="none"
            onPress={() => {}}
          >
            <Text
              variant="body"
              sx={{ color: 'tint' }}
              label="No feedback (caller handles state)"
            />
          </Pressable>

          <Pressable
            sx={{
              p: 4,
              borderWidth: 1,
              borderColor: 'border',
              borderRadius: 10,
            }}
            disabled
          >
            <Text
              variant="body"
              sx={{ color: 'disabled' }}
              label="Disabled pressable"
            />
          </Pressable>
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
