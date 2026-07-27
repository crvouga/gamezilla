import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { Switch } from './switch';

export default function SwitchExample() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(false);

  return (
    <ExampleRoot>
      <Text variant="heading" label="Switch" />

      <SchemePreview>
        <Stack spacing={3}>
          <Switch label="Notifications" value={a} onValueChange={setA} />
          <Switch label="Dark mode (on)" value={b} onValueChange={setB} />
          <Switch label="Disabled" value={c} onValueChange={setC} disabled />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
