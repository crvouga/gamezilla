import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { NumberStepper } from './number-stepper';

export default function NumberStepperExample() {
  const [n, setN] = useState(5);

  return (
    <ExampleRoot>
      <NumberStepper label="Count" value={n} onChange={setN} min={0} max={20} />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Value: ${n}`} />
    </ExampleRoot>
  );
}
