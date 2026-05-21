import {
  Box,
  Button,
  IconSymbol,
  buttonForegroundColor,
  useTheme,
  type IconSymbolName,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { HintStage } from './use-hint-stage';
import type { SolveStatus } from './use-chess-puzzle-solver';

const ICON_SIZE = 18;

function ActionIcon({
  name,
  disabled,
}: {
  name: IconSymbolName;
  disabled: boolean;
}): ReactNode {
  const theme = useTheme();
  return (
    <IconSymbol
      name={name}
      size={ICON_SIZE}
      color={buttonForegroundColor(theme, disabled)}
    />
  );
}

type HintButtonModel = {
  icon: IconSymbolName;
  label: ReactNode;
  disabled: boolean;
};

function hintButtonModel(args: {
  status: SolveStatus;
  hintStage: HintStage;
}): HintButtonModel {
  const { status, hintStage } = args;
  const baseDisabled = status !== 'solving';
  if (hintStage === 'highlight') {
    return {
      icon: 'ellipsis',
      label: <Trans>Solution</Trans>,
      disabled: baseDisabled,
    };
  }
  return {
    icon: 'ellipsis',
    label: <Trans>Hint</Trans>,
    disabled: baseDisabled || hintStage === 'solution',
  };
}

export type ChessPuzzleActionBarProps = {
  status: SolveStatus;
  hintStage: HintStage;
  onHint: () => void;
  onRetry: () => void;
  onNext: () => void;
};

export function ChessPuzzleActionBar({
  status,
  hintStage,
  onHint,
  onRetry,
  onNext,
}: ChessPuzzleActionBarProps): ReactNode {
  const hint = hintButtonModel({ status, hintStage });
  const retryDisabled = status !== 'wrong' && status !== 'solved';
  const nextDisabled = status === 'loading';
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, px: 3, alignSelf: 'stretch' }}>
      <Button
        flex={1}
        intent="neutral"
        title={hint.label}
        startIcon={<ActionIcon name={hint.icon} disabled={hint.disabled} />}
        disabled={hint.disabled}
        onPress={onHint}
      />
      <Button
        flex={1}
        intent="neutral"
        title={<Trans>Retry</Trans>}
        startIcon={
          <ActionIcon
            name="arrow.right.from.bracket"
            disabled={retryDisabled}
          />
        }
        disabled={retryDisabled}
        onPress={onRetry}
      />
      <Button
        flex={1}
        intent="primary"
        title={<Trans>Next</Trans>}
        endIcon={<ActionIcon name="chevron.right" disabled={nextDisabled} />}
        disabled={nextDisabled}
        onPress={onNext}
      />
    </Box>
  );
}
