import { useState } from 'react';
import { Box } from '../box';
import { Stack } from '../stack';
import { Text } from '../text';
import { Chip } from './chip';

const tags = ['React Native', 'TypeScript', 'Expo', 'Design System', 'UI'];

export default function ChipExample() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Expo']));

  const toggle = (tag: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Chip" />

      <Stack direction="horizontal" spacing={2} wrap>
        {tags.map((t) => (
          <Chip
            key={t}
            label={t}
            selected={selected.has(t)}
            onPressIn={() => toggle(t)}
          />
        ))}
      </Stack>

      <Chip label="Disabled" disabled />
    </Box>
  );
}
