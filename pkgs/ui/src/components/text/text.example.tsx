import { Box } from '../box';
import { Text } from './text';

const variants = [
  'body',
  'bodyBold',
  'caption',
  'label',
  'title',
  'subtitle',
  'heading',
  'navigationTitle',
  'link',
  'mono',
] as const;

export default function TextExample() {
  return (
    <Box sx={{ p: 4, gap: 3 }}>
      <Text variant="heading" label="Text" />
      {variants.map((v) => (
        <Box key={v} sx={{ gap: 0.5 }}>
          <Text variant="caption" label={v} />
          <Text
            variant={v}
            label="The quick brown fox jumps over the lazy dog"
          />
        </Box>
      ))}
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label="Custom sx color override"
      />
      <Box sx={{ gap: 0.5 }}>
        <Text variant="caption" label="Empty string (reserves line height)" />
        <Text variant="body" label="" />
        <Text variant="body" label="Filled after load" />
      </Box>
    </Box>
  );
}
