import { Pressable } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type AccountDeviceOpenLinkProps = {
  deviceId: string;
  onOpenDevice: (deviceId: string) => void;
  accessibilityLabel?: string;
  children: ReactNode;
};

/**
 * Pressable wrapper that owns the "open device detail" press for a row.
 * The id-to-route mapping lives at the consumer level (account screen) and
 * is wired through `onOpenDevice` so this stays a pure layout atom.
 */
export function AccountDeviceOpenLink({
  deviceId,
  onOpenDevice,
  accessibilityLabel,
  children,
}: AccountDeviceOpenLinkProps): ReactNode {
  return (
    <Pressable
      onPress={() => onOpenDevice(deviceId)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
