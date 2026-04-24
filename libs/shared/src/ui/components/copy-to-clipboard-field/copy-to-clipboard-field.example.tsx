import { Box } from '../box';
import { Text } from '../text';
import { CopyToClipboardField } from './copy-to-clipboard-field';

export default function CopyToClipboardFieldExample() {
  return (
    <Box sx={{ p: 4, gap: 6 }}>
      <Text variant="heading" label="CopyToClipboardField" />

      <CopyToClipboardField
        label="Commit hash"
        helperText="Tap the field or icon to copy"
        value="a1b2c3d4e5f6789012345678901234567890abcd"
        copiedResetMs={2200}
      />

      <CopyToClipboardField
        label="API origin (no helper)"
        value="https://api.example.com"
        selectable
      />
    </Box>
  );
}
