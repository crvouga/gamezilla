/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Web: shows on hover. Native: long-press the child control (via
 * {@link useTooltipTrigger}) to show; release to dismiss.
 * Renders through {@link useOverlayPortal} so it stacks above modals.
 */

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { Platform, View } from 'react-native';

import { useOverlayPortalSlot } from '../overlay-portal/overlay-portal';
import { TooltipBubble } from './tooltip-bubble';
import type { TooltipPlacement } from './tooltip-layout';
import { useTooltipState } from './use-tooltip-state';

export type { TooltipPlacement } from './tooltip-layout';

export type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
};

type TooltipController = {
  show: () => void;
  hide: () => void;
};

const TooltipContext = createContext<TooltipController | null>(null);

export function useTooltipTrigger(): TooltipController | null {
  return useContext(TooltipContext);
}

type WebHoverProps = {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

function webHoverProps(show: () => void, hide: () => void): WebHoverProps {
  if (Platform.OS !== 'web') return {};
  return {
    onMouseEnter: show,
    onMouseLeave: hide,
  };
}

export function Tooltip({
  label,
  children,
  placement = 'bottom',
}: TooltipProps): ReactNode {
  const anchorRef = useRef<View>(null);
  const portalId = useId();
  const { visible, enterKey, anchor, show, hide } = useTooltipState(anchorRef);

  const tooltipNode =
    visible && anchor !== null ? (
      <TooltipBubble
        label={label}
        anchor={anchor}
        preferredPlacement={placement}
        enterKey={enterKey}
      />
    ) : null;

  useOverlayPortalSlot(`tooltip-${portalId}`, tooltipNode, visible);

  const controller = useMemo(
    (): TooltipController => ({ show, hide }),
    [show, hide]
  );

  return (
    <TooltipContext.Provider value={controller}>
      <View
        ref={anchorRef}
        collapsable={false}
        style={{ alignSelf: 'center' }}
        {...webHoverProps(show, hide)}
      >
        {children}
      </View>
    </TooltipContext.Provider>
  );
}
