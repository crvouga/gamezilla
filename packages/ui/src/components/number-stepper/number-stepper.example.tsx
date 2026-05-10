import { useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { NumberStepper } from './number-stepper';

export default function NumberStepperExample() {
  const [n, setN] = useState(5);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="NumberStepper" />
      <NumberStepper label="Count" value={n} onChange={setN} min={0} max={20} />
      <Text variant="caption" sx={{ opacity: 0.75 }} label={`Value: ${n}`} />
    </Box>
  );
}
