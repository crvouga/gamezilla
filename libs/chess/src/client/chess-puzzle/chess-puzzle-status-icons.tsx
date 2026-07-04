import { Spinner, useTheme, type Theme } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChessPuzzleStatusBadge } from './chess-puzzle-status-badge';

export type ChessPuzzleStatusKind =
  | 'loading'
  | 'whiteToMove'
  | 'blackToMove'
  | 'correct'
  | 'wrong'
  | 'solved';

const SIZE = 22;

// Literal chess piece colors (side to move), not theme UI chrome.
const PIECE_WHITE = '#ffffff';
const PIECE_BLACK = '#1a1a1a';

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
    borderColor: PIECE_WHITE,
  },
  blackSquare: {
    width: 14,
    height: 14,
    backgroundColor: PIECE_BLACK,
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PIECE_BLACK,
  },
});

/** Semantic outcome badge tokens (fill + contrast-safe mark) by kind. */
function outcomeColors(
  theme: Theme,
  kind: 'correct' | 'wrong' | 'solved'
): { bg: string; fg: string } {
  const c = theme.colors;
  if (kind === 'correct') return { bg: c.success, fg: c.onSuccess };
  if (kind === 'wrong') return { bg: c.destructive, fg: c.onDestructive };
  return { bg: c.warning, fg: c.onWarning };
}

function outcomeMark(kind: 'correct' | 'wrong' | 'solved'): ReactNode {
  if (kind === 'correct') {
    return <Trans id="chess.puzzleStatus.correctMark">✓</Trans>;
  }
  if (kind === 'wrong') {
    return <Trans id="chess.puzzleStatus.wrongMark">✕</Trans>;
  }
  return <Trans id="chess.puzzleStatus.solvedMark">★</Trans>;
}

export function ChessPuzzleStatusIcon({
  kind,
}: {
  kind: ChessPuzzleStatusKind;
}): ReactNode {
  const theme = useTheme();
  if (kind === 'loading') {
    return (
      <View style={styles.root}>
        <Spinner size="small" />
      </View>
    );
  }
  if (kind === 'whiteToMove') {
    return (
      <View style={styles.root}>
        <View style={styles.whiteSquare} />
        <View style={styles.centerDot} />
      </View>
    );
  }
  if (kind === 'blackToMove') {
    return (
      <View style={styles.root}>
        <View style={styles.blackSquare} />
      </View>
    );
  }
  const { bg, fg } = outcomeColors(theme, kind);
  return (
    <View style={styles.root}>
      <ChessPuzzleStatusBadge bg={bg} fg={fg} mark={outcomeMark(kind)} />
    </View>
  );
}
