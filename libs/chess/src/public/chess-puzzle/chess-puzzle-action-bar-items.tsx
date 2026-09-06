/**
 * Maps {@link buildChessPuzzleActionBarPlan} slots to BottomActionBar items.
 */

import { Trans } from '@lingui/react/macro';
import {
  type BottomActionBarItem,
  ChevronLeftIcon,
  ChevronRightIcon,
  type IconComponent,
  LightbulbIcon,
  RotateCcwIcon,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import {
  buildChessPuzzleActionBarPlan,
  type ChessPuzzleActionBarSlot,
} from './chess-puzzle-action-bar-plan';
import type { SolveStatus } from './use-chess-puzzle-solver';
import type { HintStage } from './use-hint-stage';

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
    onPress: onHint,
    testID: 'chess-puzzle-action-hint',
  };
}

function mapNavAction(args: {
  id: 'back' | 'forward' | 'next' | 'retry' | 'solution';
  label: ReactNode;
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
    onPress: args.onPress,
    testID: `chess-puzzle-action-${args.id}`,
  };
}

function mapSlot(
  slot: ChessPuzzleActionBarSlot,
  p: ChessPuzzleActionBarModel
): BottomActionBarItem {
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
      onPress: p.onRetry,
      testID: 'chess-puzzle-action-retry',
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
      onPress: p.onNext,
      testID: 'chess-puzzle-action-next',
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

/** Builds mode-specific bottom-bar items. */
export function buildChessPuzzleActionBarItems(
  p: ChessPuzzleActionBarModel
): BottomActionBarItem[] {
  return buildChessPuzzleActionBarPlan(p).map((slot) => mapSlot(slot, p));
}
