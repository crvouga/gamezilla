import { useState } from 'react';
import { Box } from '../box';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Checkbox } from './checkbox';

export default function CheckboxExample() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Checkbox" />

      <SchemePreview>
        <Stack spacing={3}>
          <Checkbox label="Accept terms" checked={a} onToggle={setA} />
          <Checkbox
            label="Subscribe to newsletter"
            checked={b}
            onToggle={setB}
          />
          <Checkbox label="Disabled" checked={c} onToggle={setC} disabled />
        </Stack>
      </SchemePreview>
    </Box>
  );
}
