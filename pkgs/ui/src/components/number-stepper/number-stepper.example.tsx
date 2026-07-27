import { useState } from 'react';
import { Text } from '../text';
import { NumberStepper } from './number-stepper';
import { ExampleRoot } from '../explorer/example-root';

export default function NumberStepperExample() {
  const [n, setN] = useState(5);

  return (
    <ExampleRoot>
      <Text variant="heading" label="NumberStepper" />
      <NumberStepper label="Count" value={n} onChange={setN} min={0} max={20} />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Value: ${n}`} />
    </ExampleRoot>
  );
}
