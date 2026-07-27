import { useState } from 'react';
import type { ModalSize } from '../../theme/modal-size';
import { Button } from '../button';
import { Stack } from '../stack';
import { Text } from '../text';
import { ResponsiveSurface } from './responsive-surface';
import { ExampleRoot } from '../explorer/example-root';

const SIZES: ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

export default function ResponsiveSurfaceExample() {
  const [openSize, setOpenSize] = useState<ModalSize | null>(null);

  return (
    <ExampleRoot>
      <Text variant="heading" label="ResponsiveSurface" />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label="On mobile: bottom sheet. On tablet/desktop: centered modal with a width bucket."
      />
      <Stack spacing={2}>
        {SIZES.map((size) => (
          <Button
            key={size}
            title={`Open — ${size}`}
            onPress={() => setOpenSize(size)}
          />
        ))}
      </Stack>
      {SIZES.map((size) => (
        <ResponsiveSurface
          key={size}
          visible={openSize === size}
          onClose={() => setOpenSize(null)}
          title={`Size: ${size}`}
          size={size}
        >
          <Text
            variant="body"
            label="Surface body. Close via ✕, backdrop tap, or swipe down (mobile)."
          />
        </ResponsiveSurface>
      ))}
    </ExampleRoot>
  );
}
