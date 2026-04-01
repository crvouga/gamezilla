import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { Pressable } from './pressable';

export default function PressableExample() {
  const [count, setCount] = useState(0);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Pressable</Text>

      <Pressable
        sx={{ p: 4, background: 'surface', borderRadius: 8 }}
        onPress={() => setCount((c) => c + 1)}
      >
        <Text variant="body">Tap count: {count}</Text>
      </Pressable>

      <Pressable
        sx={{
          p: 4,
          background: 'tint',
          borderRadius: 8,
          alignItems: 'center',
        }}
        onPress={() => setCount(0)}
      >
        <Text variant="bodyBold" sx={{ color: 'paper' }}>
          Reset
        </Text>
      </Pressable>

      <Pressable
        sx={{
          p: 4,
          borderWidth: 1,
          borderColor: 'border',
          borderRadius: 8,
        }}
        disabled
      >
        <Text variant="body" sx={{ color: 'disabled' }}>
          Disabled pressable
        </Text>
      </Pressable>
    </Box>
  );
}
