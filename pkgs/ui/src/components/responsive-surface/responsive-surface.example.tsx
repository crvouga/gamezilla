import { useState } from 'react';
import type { ModalSize } from '../../theme/modal-size';
import { Button } from '../button';
import { Stack } from '../stack';
import { Text } from '../text';
import { ResponsiveSurface } from './responsive-surface';
import { ExampleRoot } from '../explorer/example-root';

const SIZES: ModalSize[] = ['small', 'medium', 'large', 'fullWidth'];

type OpenSurface = ModalSize | 'untitled';

export default function ResponsiveSurfaceExample() {
  const [openSize, setOpenSize] = useState<OpenSurface | null>(null);

  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label="On mobile: bottom sheet. On tablet/desktop: centered modal with a width bucket. Every surface shows a top-right close control."
      />
      <Stack spacing={2}>
        {SIZES.map((size) => (
          <Button
            key={size}
            title={`Open — ${size}`}
            onPress={() => setOpenSize(size)}
          />
        ))}
        <Button
          title="Open — untitled (close only)"
          onPress={() => setOpenSize('untitled')}
        />
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
            label="Surface body. Close via X, backdrop tap, or swipe down (mobile)."
          />
        </ResponsiveSurface>
      ))}
      <ResponsiveSurface
        visible={openSize === 'untitled'}
        onClose={() => setOpenSize(null)}
        size="medium"
      >
        <Text
          variant="body"
          label="Untitled surface — close control only in the header."
        />
      </ResponsiveSurface>
    </ExampleRoot>
  );
}
