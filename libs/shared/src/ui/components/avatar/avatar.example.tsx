import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Avatar } from './avatar';

export default function AvatarExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="Avatar" />

      <Stack direction="horizontal" spacing={3} align="center">
        <Avatar initials="JD" size={32} />
        <Avatar initials="AB" size={40} background="success" />
        <Avatar initials="XY" size={48} background="warning" />
        <Avatar initials="ZZ" size={56} background="destructive" />
      </Stack>

      <Stack direction="horizontal" spacing={3} align="center">
        <Avatar uri="https://i.pravatar.cc/100?u=1" size={40} />
        <Avatar uri="https://i.pravatar.cc/100?u=2" size={48} />
        <Avatar uri="https://i.pravatar.cc/100?u=3" size={56} />
      </Stack>
    </Box>
  );
}
