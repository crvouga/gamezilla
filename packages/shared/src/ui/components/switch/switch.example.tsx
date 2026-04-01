import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { Switch } from './switch';

export default function SwitchExample() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Switch</Text>

      <Switch label="Notifications" value={a} onValueChange={setA} />
      <Switch label="Dark mode (on)" value={b} onValueChange={setB} />
      <Switch label="Disabled" value={c} onValueChange={setC} disabled />
    </Box>
  );
}
