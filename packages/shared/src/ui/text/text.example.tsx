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
  'link',
  'mono',
] as const;

export default function TextExample() {
  return (
    <Box sx={{ p: 4, gap: 3 }}>
      <Text variant="heading">Text</Text>
      {variants.map((v) => (
        <Box key={v} sx={{ gap: 0.5 }}>
          <Text variant="caption">{v}</Text>
          <Text variant={v}>The quick brown fox jumps over the lazy dog</Text>
        </Box>
      ))}
      <Text variant="body" sx={{ color: 'textSecondary' }}>
        Custom sx color override
      </Text>
    </Box>
  );
}
