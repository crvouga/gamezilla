import { Link } from 'expo-router';

import { useTheme } from '@gamezilla/shared/theme';
import { Box, Text } from '@gamezilla/shared/ui';

export default function ModalScreen() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        p: 5,
      }}
    >
      <Text variant="title">This is a modal</Text>
      <Link href="/todos" dismissTo style={theme.sx({ mt: 3.75, py: 3.75 })}>
        <Text variant="link">Back to Todos</Text>
      </Link>
    </Box>
  );
}
