import { Box, IconSymbol, Pressable, Text, useTheme } from '@gamezilla/ui';
import type { IconSymbolName } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { SolveStatus } from './use-chess-puzzle-solver';

type ActionButtonProps = {
  icon: IconSymbolName;
  label: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onPress: () => void;
};

function ActionButton({
  icon,
  label,
  disabled = false,
  primary = false,
  onPress,
}: ActionButtonProps): ReactNode {
  const theme = useTheme();
  const fg = primary ? theme.colors.surface : theme.colors.text;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ flex: 1 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 3,
          borderRadius: 8,
          background: primary ? 'tint' : 'surface',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <IconSymbol name={icon} size={18} color={fg} />
        <Text variant="bodyBold" style={{ color: fg }} label={label} />
      </Box>
    </Pressable>
  );
}

export type ChessPuzzleActionBarProps = {
  status: SolveStatus;
  onHint: () => void;
  onRetry: () => void;
  onNext: () => void;
};

export function ChessPuzzleActionBar({
  status,
  onHint,
  onRetry,
  onNext,
}: ChessPuzzleActionBarProps): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, px: 3, alignSelf: 'stretch' }}>
      <ActionButton
        icon="ellipsis"
        label={<Trans>Hint</Trans>}
        disabled={status !== 'solving'}
        onPress={onHint}
      />
      <ActionButton
        icon="arrow.right.from.bracket"
        label={<Trans>Retry</Trans>}
        disabled={status !== 'wrong' && status !== 'solved'}
        onPress={onRetry}
      />
      <ActionButton
        icon="chevron.right"
        label={<Trans>Next</Trans>}
        primary
        disabled={status === 'loading'}
        onPress={onNext}
      />
    </Box>
  );
}
