import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});

/** Circular outcome badge: semantic fill + contrast-safe mark. */
export function ChessPuzzleStatusBadge({
  bg,
  fg,
  mark,
}: {
  bg: string;
  fg: string;
  mark: ReactNode;
}): ReactNode {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.mark, { color: fg }]} label={mark} />
    </View>
  );
}
