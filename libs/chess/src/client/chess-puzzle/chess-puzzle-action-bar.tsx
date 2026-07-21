import {
  BottomActionBar,
  ChevronRightIcon,
  LightbulbIcon,
  LogOutIcon,
  type BottomActionBarItem,
  type IconComponent,
} from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { HintStage } from './use-hint-stage';
import type { SolveStatus } from './use-chess-puzzle-solver';

type HintButtonModel = {
  icon: IconComponent;
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
      icon: LightbulbIcon,
      label: <Trans>Solution</Trans>,
      disabled: baseDisabled,
    };
  }
  return {
    icon: LightbulbIcon,
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

function buildItems(p: ChessPuzzleActionBarProps): BottomActionBarItem[] {
  const hint = hintButtonModel({
    status: p.status,
    hintStage: p.hintStage,
  });
  const retryDisabled = p.status !== 'wrong' && p.status !== 'solved';
  const nextDisabled = p.status === 'loading';
  return [
    {
      type: 'action',
      id: 'hint',
      label: hint.label,
      icon: hint.icon,
      disabled: hint.disabled,
      onPress: p.onHint,
    },
    {
      type: 'action',
      id: 'retry',
      label: <Trans>Retry</Trans>,
      icon: LogOutIcon,
      disabled: retryDisabled,
      onPress: p.onRetry,
    },
    {
      type: 'button',
      id: 'next',
      title: <Trans>Next</Trans>,
      endIcon: <ChevronRightIcon size={18} />,
      disabled: nextDisabled,
      onPress: p.onNext,
    },
  ];
}

export function ChessPuzzleActionBar(
  props: ChessPuzzleActionBarProps
): ReactNode {
  return <BottomActionBar items={buildItems(props)} />;
}
