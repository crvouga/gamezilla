import { Trans } from '@lingui/solid/macro';
import type { BottomActionBarItem } from '@pkgs/ui-client/bottom-action-bar-types';
import { ChevronLeftIcon, ChevronRightIcon, ChevronsRightIcon, LightbulbIcon, RotateCcwIcon } from '@pkgs/ui-client/icons';
import type { IconComponent } from '@pkgs/ui-client/create-icon';
import type { JSX } from 'solid-js';

import { buildChessPuzzleActionBarPlan } from '@libs/chess-puzzle-shared/action-bar-plan';
import type { ChessPuzzleActionBarSlot } from '@libs/chess-puzzle-shared/action-bar-plan';
import type { HintStage } from '@libs/chess-puzzle-shared/hint-stage';
import type { SolveStatus } from '@libs/chess-puzzle-shared/solve-status';

export type ChessPuzzleActionBarModel = {
  status: SolveStatus;
  hintStage: HintStage;
  canGoBack: boolean;
  canGoForward: boolean;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onNext: () => void;
};

function mapHintSlot(
  slot: Extract<ChessPuzzleActionBarSlot, { id: 'hint' }>,
  onHint: () => void
): BottomActionBarItem {
  return {
    type: 'action',
    id: 'hint',
    label:
      slot.hintLabel === 'solution' ? (
        <Trans>Solution</Trans>
      ) : (
        <Trans>Hint</Trans>
      ),
    icon: LightbulbIcon,
    disabled: slot.disabled,
    onClick: onHint,
    dataSet: { testid: 'chess-puzzle-action-hint' },
  };
}

function mapNavAction(args: {
  id: 'back' | 'forward' | 'next' | 'retry' | 'solution' | 'skip';
  label: JSX.Element;
  icon: IconComponent;
  disabled: boolean;
  onPress: () => void;
}): BottomActionBarItem {
  return {
    type: 'action',
    id: args.id,
    label: args.label,
    icon: args.icon,
    disabled: args.disabled,
    onClick: args.onPress,
    dataSet: { testid: `chess-puzzle-action-${args.id}` },
  };
}

function mapSlot(
  slot: ChessPuzzleActionBarSlot,
  p: ChessPuzzleActionBarModel
): BottomActionBarItem {
  if (slot.id === 'skip') {
    return mapNavAction({
      id: 'skip',
      label: <Trans>Skip</Trans>,
      icon: ChevronsRightIcon,
      disabled: slot.disabled,
      onPress: p.onSkip,
    });
  }
  if (slot.id === 'hint') return mapHintSlot(slot, p.onHint);
  if (slot.id === 'solution') {
    return mapNavAction({
      id: 'solution',
      label: <Trans>Solution</Trans>,
      icon: LightbulbIcon,
      disabled: slot.disabled,
      onPress: p.onSolution,
    });
  }
  if (slot.id === 'back') {
    return mapNavAction({
      id: 'back',
      label: <Trans>Back</Trans>,
      icon: ChevronLeftIcon,
      disabled: slot.disabled,
      onPress: p.onBack,
    });
  }
  if (slot.id === 'forward') {
    return mapNavAction({
      id: 'forward',
      label: <Trans>Forward</Trans>,
      icon: ChevronRightIcon,
      disabled: slot.disabled,
      onPress: p.onForward,
    });
  }
  if (slot.id === 'retry' && slot.type === 'button') {
    return {
      type: 'button',
      id: 'retry',
      title: <Trans>Retry</Trans>,
      intent: 'danger',
      startIcon: <RotateCcwIcon />,
      onClick: p.onRetry,
      dataSet: { testid: 'chess-puzzle-action-retry' },
    };
  }
  if (slot.id === 'retry') {
    return mapNavAction({
      id: 'retry',
      label: <Trans>Retry</Trans>,
      icon: RotateCcwIcon,
      disabled: slot.disabled,
      onPress: p.onRetry,
    });
  }
  if (slot.type === 'button') {
    return {
      type: 'button',
      id: 'next',
      title: <Trans>Next</Trans>,
      intent: 'success',
      endIcon: <ChevronRightIcon />,
      onClick: p.onNext,
      dataSet: { testid: 'chess-puzzle-action-next' },
    };
  }
  return mapNavAction({
    id: 'next',
    label: <Trans>Next</Trans>,
    icon: ChevronRightIcon,
    disabled: slot.disabled,
    onPress: p.onNext,
  });
}

export function buildChessPuzzleActionBarItems(
  p: ChessPuzzleActionBarModel
): BottomActionBarItem[] {
  return buildChessPuzzleActionBarPlan(p).map((slot) => mapSlot(slot, p));
}
