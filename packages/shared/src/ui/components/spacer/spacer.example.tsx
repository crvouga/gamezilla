import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Spacer } from './spacer';

export default function SpacerExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Spacer" />

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Push items apart" />
        <Stack
          direction="horizontal"
          align="center"
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="body" label="Left" />
          <Spacer />
          <Text variant="body" label="Right" />
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Toolbar pattern" />
        <Stack
          direction="horizontal"
          align="center"
          spacing={2}
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="bodyBold" label="Title" />
          <Spacer />
          <Box sx={{ px: 3, py: 1, background: 'tint', borderRadius: 6 }}>
            <Text variant="label" sx={{ color: 'paper' }} label="Action" />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
