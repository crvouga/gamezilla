import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Spacer } from './spacer';

export default function SpacerExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Spacer</Text>

      <Box sx={{ gap: 1 }}>
        <Text variant="label">Push items apart</Text>
        <Stack
          direction="horizontal"
          align="center"
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="body">Left</Text>
          <Spacer />
          <Text variant="body">Right</Text>
        </Stack>
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label">Toolbar pattern</Text>
        <Stack
          direction="horizontal"
          align="center"
          spacing={2}
          sx={{ p: 3, background: 'surface', borderRadius: 8 }}
        >
          <Text variant="bodyBold">Title</Text>
          <Spacer />
          <Box sx={{ px: 3, py: 1, background: 'tint', borderRadius: 6 }}>
            <Text variant="label" sx={{ color: 'paper' }}>
              Action
            </Text>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
