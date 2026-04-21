import { useState } from 'react';
import { Box } from '../box';
import { Button } from '../button';
import { Text } from '../text';
import { ResponsiveSurface } from './responsive-surface';

export default function ResponsiveSurfaceExample() {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="ResponsiveSurface" />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label="On mobile breakpoint: bottom sheet. On tablet/desktop: centered modal."
      />
      <Button title="Open surface" onPress={() => setOpen(true)} />
      <ResponsiveSurface
        visible={open}
        onClose={() => setOpen(false)}
        title="Example"
      >
        <Text
          variant="body"
          label="Surface body. Close via the ✕, backdrop tap, or swipe down (mobile)."
        />
      </ResponsiveSurface>
    </Box>
  );
}
