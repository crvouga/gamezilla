import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text/text';
import { GradientBox } from './gradient-box';

export default function GradientBoxExample() {
  return (
    <ExampleRoot>
      <Text variant="heading" sx={{ fontSize: 'lg' }} label="GradientBox" />

      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Default horizontal gradient uses theme tintHover → tintActive."
      />

      <GradientBox
        sx={{ p: 4, borderRadius: 16, minHeight: 88, justifyContent: 'center' }}
      >
        <Text variant="bodyBold" label="Primary gradient card" />
        <Text
          variant="caption"
          sx={{ mt: 1 }}
          label="Auto contrast-safe text — no hardcoded color"
        />
      </GradientBox>

      <GradientBox
        colors={['#4F46E5', '#7C3AED', '#DB2777']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        sx={{ p: 4, borderRadius: 12 }}
      >
        <Text variant="bodyBold" label="Custom stops (diagonal)" />
      </GradientBox>
    </ExampleRoot>
  );
}
