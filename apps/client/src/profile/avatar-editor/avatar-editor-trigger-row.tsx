import { Pressable, Text } from '@gamezilla/lib/ui';
import { Trans } from '@gamezilla/lib/i18n';
import type { ReactNode } from 'react';

export function TriggerRow({
  label,
  value,
  onPress,
}: {
  label: ReactNode;
  value: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        py: 3,
        borderBottomWidth: 1,
        borderColor: 'border',
        gap: 2,
      }}
    >
      <Text variant="label" label={label} style={{ flex: 1 }} />
      <Text
        variant="body"
        numberOfLines={1}
        style={{ flex: 1.5, textAlign: 'right', opacity: 0.85 }}
        label={value}
      />
      <Text variant="caption" label={<Trans>›</Trans>} />
    </Pressable>
  );
}
