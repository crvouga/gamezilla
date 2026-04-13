import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { IconButton } from './icon-button';

export default function IconButtonExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="IconButton" />

      <Stack direction="horizontal" spacing={3} align="center">
        <IconButton onPress={() => {}} background="surface">
          <Text variant="body" label="✕" />
        </IconButton>

        <IconButton onPress={() => {}} size={48} background="tint">
          <Text variant="bodyBold" sx={{ color: 'paper' }} label="+" />
        </IconButton>

        <IconButton onPress={() => {}} size={32} background="destructive">
          <Text sx={{ color: 'paper', fontSize: 'xs' }} label="🗑" />
        </IconButton>

        <IconButton disabled onPress={() => {}} background="surface">
          <Text variant="body" label="⚙" />
        </IconButton>
      </Stack>
    </Box>
  );
}
