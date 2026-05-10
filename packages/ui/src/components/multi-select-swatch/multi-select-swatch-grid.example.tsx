import { useMemo, useState } from 'react';
import { Box } from '../box';
import { Text } from '../text';
import { MultiSelectSwatchGrid } from './multi-select-swatch-grid';

const PALETTE = ['ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff'];

export default function MultiSelectSwatchGridExample() {
  const defaultPalette = useMemo(() => [...PALETTE], []);
  const [value, setValue] = useState<string[]>(() => [...PALETTE]);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="MultiSelectSwatchGrid" />
      <MultiSelectSwatchGrid
        label="Colors"
        palette={[...new Set([...PALETTE, ...value])]}
        value={value}
        onChange={setValue}
        allowTransparent
        defaultPalette={defaultPalette}
      />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label={`Selected (${value.length}): ${value.join(', ')}`}
      />
    </Box>
  );
}
