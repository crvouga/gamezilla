import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type ChessPuzzleStatusKind =
  | 'whiteToMove'
  | 'blackToMove'
  | 'correct'
  | 'wrong'
  | 'solved';

const SIZE = 22;

const styles = StyleSheet.create({
  root: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whiteSquare: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  blackSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#1a1a1a',
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1a1a1a',
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});

export function ChessPuzzleStatusIcon({
  kind,
}: {
  kind: ChessPuzzleStatusKind;
}): ReactNode {
  switch (kind) {
    case 'whiteToMove':
      return (
        <View style={styles.root}>
          <View style={styles.whiteSquare} />
          <View style={styles.centerDot} />
        </View>
      );
    case 'blackToMove':
      return (
        <View style={styles.root}>
          <View style={styles.blackSquare} />
        </View>
      );
    case 'correct':
      return (
        <View style={styles.root}>
          <View style={[styles.badge, { backgroundColor: '#22a06b' }]}>
            <Text style={styles.badgeMark}>✓</Text>
          </View>
        </View>
      );
    case 'wrong':
      return (
        <View style={styles.root}>
          <View style={[styles.badge, { backgroundColor: '#e5484d' }]}>
            <Text style={styles.badgeMark}>✕</Text>
          </View>
        </View>
      );
    case 'solved':
      return (
        <View style={styles.root}>
          <View style={[styles.badge, { backgroundColor: '#f5a623' }]}>
            <Text style={styles.badgeMark}>★</Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}
