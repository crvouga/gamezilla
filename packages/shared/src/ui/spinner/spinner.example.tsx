import { Box } from '../box';
import { Text } from '../text';
import { Stack } from '../stack';
import { Spinner } from './spinner';

export default function SpinnerExample() {
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading">Spinner</Text>

      <Stack direction="horizontal" spacing={4} align="center">
        <Spinner size="small" />
        <Spinner size="large" />
        <Spinner color="success" size="large" />
        <Spinner color="destructive" size="large" />
      </Stack>
    </Box>
  );
}
