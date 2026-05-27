import { useState } from 'react';
import { Box } from '../box';
import { SchemePreview } from '../explorer/scheme-preview';
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

      <SchemePreview>
        <Stack spacing={3}>
          <Stack direction="horizontal" spacing={2} wrap>
            {tags.map((t) => (
              <Chip
                key={t}
                label={t}
                selected={selected.has(t)}
                onPress={() => toggle(t)}
              />
            ))}
          </Stack>

          <Stack direction="horizontal" spacing={2}>
            <Chip label="Unselected" />
            <Chip label="Selected" selected />
            <Chip label="Disabled" disabled />
          </Stack>
        </Stack>
      </SchemePreview>
    </Box>
  );
}
