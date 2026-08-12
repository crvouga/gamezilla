/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Desktop web: shows on hover when {@link useHoverCapable} is true.
 * Touch / native: long-press the child control (via {@link useTooltipTrigger})
 * to show; release to dismiss. Renders through {@link useOverlayPortal} so it
 * stacks above modals.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useRef,
} from 'react';
import type { View } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { useHoverCapable } from '../../theme';
import { Box } from '../box';
import { useOverlayPortalSlot } from '../overlay-portal/overlay-portal';
import { TooltipBubble } from './tooltip-bubble';
import type { TooltipPlacement } from './tooltip-layout';
import { useTooltipState } from './use-tooltip-state';

export type { TooltipPlacement } from './tooltip-layout';

export type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  placement?: TooltipPlacement;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
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

function webHoverProps(
  hoverCapable: boolean,
  show: () => void,
  hide: () => void
): WebHoverProps {
  if (!hoverCapable) return {};
  return {
    onMouseEnter: show,
    onMouseLeave: hide,
  };
}

export function Tooltip({
  label,
  children,
  placement = 'bottom',
  dataSet,
}: TooltipProps): ReactNode {
  const anchorRef = useRef<View>(null);
  const portalId = useId();
  const hoverCapable = useHoverCapable();
  const { visible, enterKey, anchor, show, hide } = useTooltipState(anchorRef);

  const tooltipNode =
    visible && anchor !== null ? (
      <TooltipBubble
        label={label}
        anchor={anchor}
        preferredPlacement={placement}
        enterKey={enterKey}
        {...(dataSet !== undefined ? { dataSet } : {})}
      />
    ) : null;

  useOverlayPortalSlot(`tooltip-${portalId}`, tooltipNode, visible);

  const controller = useMemo(
    (): TooltipController => ({ show, hide }),
    [show, hide]
  );

  return (
    <TooltipContext.Provider value={controller}>
      <Box
        ref={anchorRef}
        collapsable={false}
        sx={{ alignSelf: 'center' }}
        {...webHoverProps(hoverCapable, show, hide)}
      >
        {children}
      </Box>
    </TooltipContext.Provider>
  );
}
