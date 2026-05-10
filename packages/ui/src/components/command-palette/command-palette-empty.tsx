import { Box } from '../box';
import { Text } from '../text';

export function CommandPaletteEmpty() {
  return (
    <Box sx={{ py: 6, px: 4 }}>
      <Text
        variant="body"
        sx={{ color: 'textSecondary', textAlign: 'center' }}
        label="No matching commands"
      />
    </Box>
  );
}
