import { Box } from '../box';
import { Text } from '../text';
import { Stack } from './stack';

function ColorBox({ label, color }: { label: string; color: string }) {
  return (
    <Box sx={{ p: 3, background: color, borderRadius: 8, minWidth: 64 }}>
      <Text variant="caption" sx={{ color: 'paper' }} label={label} />
    </Box>
  );
}

export default function StackExample() {
  return (
    <Box sx={{ p: 4, gap: 6 }}>
      <Text variant="heading" label="Stack" />

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Vertical (default)" />
        <Stack spacing={2}>
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Horizontal" />
        <Stack direction="horizontal" spacing={2}>
          <ColorBox label="A" color="tint" />
          <ColorBox label="B" color="info" />
          <ColorBox label="C" color="success" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Horizontal, centered, space-between" />
        <Stack direction="horizontal" spacing={2} align="center" justify="space-between">
          <ColorBox label="Left" color="warning" />
          <ColorBox label="Right" color="destructive" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Wrap" />
        <Stack direction="horizontal" spacing={2} wrap>
          {Array.from({ length: 8 }, (_, i) => (
            <ColorBox key={i} label={`${i + 1}`} color="tint" />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
