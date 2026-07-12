/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Web: shows on hover. Native: long-press the child control (via
 * {@link useTooltipTrigger}) to show; release to dismiss.
 * Renders through {@link useOverlayPortal} so it stacks above modals.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
} from 'react';
import { Platform, View, type LayoutRectangle } from 'react-native';

import { useTheme } from '../../theme';
import { borderRadius } from '../../theme/scale';
import { Pressable } from '../pressable';
import { useOverlayPortalSlot } from '../overlay-portal/overlay-portal';
import { Text } from '../text';

export type TooltipPlacement = 'top' | 'bottom';

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

const OFFSET = 6;

function tooltipPosition(
  anchor: LayoutRectangle,
  placement: TooltipPlacement
): { top: number; left: number } {
  const centerX = anchor.x + anchor.width / 2;
  if (placement === 'top') {
    return { top: anchor.y - OFFSET, left: centerX };
  }
  return { top: anchor.y + anchor.height + OFFSET, left: centerX };
}

function TooltipBubble({
  label,
  anchor,
  placement,
}: {
  label: ReactNode;
  anchor: LayoutRectangle;
  placement: TooltipPlacement;
}): ReactNode {
  const theme = useTheme();
  const { top, left } = tooltipPosition(anchor, placement);
  const translateY = placement === 'top' ? -4 : 0;

  return (
    <View
      pointerEvents="none"
      style={
        Platform.OS === 'web'
          ? ({
              position: 'fixed',
              top,
              left,
              transform: `translate(-50%, ${translateY}px)`,
              zIndex: 1_000_001,
            } as unknown as View['props']['style'])
          : {
              position: 'absolute',
              top,
              left,
              transform: [{ translateX: -60 }, { translateY }],
              zIndex: 1_000_001,
            }
      }
    >
      <View
        style={{
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: borderRadius.sm,
          paddingHorizontal: 8,
          paddingVertical: 4,
          maxWidth: 240,
          ...(theme.elevation(3).boxShadow
            ? { boxShadow: theme.elevation(3).boxShadow }
            : {}),
        }}
      >
        <Text
          variant="caption"
          label={label}
          numberOfLines={2}
          sx={{ color: 'text', textAlign: 'center' }}
        />
      </View>
    </View>
  );
}

export function Tooltip({
  label,
  children,
  placement = 'bottom',
}: TooltipProps): ReactNode {
  const anchorRef = useRef<ElementRef<typeof Pressable>>(null);
  const portalId = useId();
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);

  const show = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
    });
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setAnchor(null);
  }, []);

  const tooltipNode =
    visible && anchor !== null ? (
      <TooltipBubble label={label} anchor={anchor} placement={placement} />
    ) : null;

  useOverlayPortalSlot(`tooltip-${portalId}`, tooltipNode, visible);

  const controller = useMemo(
    (): TooltipController => ({ show, hide }),
    [show, hide]
  );

  return (
    <TooltipContext.Provider value={controller}>
      <Pressable
        ref={anchorRef}
        feedback="none"
        collapsable={false}
        style={{ alignSelf: 'flex-start' }}
        {...(Platform.OS === 'web' ? { onHoverIn: show, onHoverOut: hide } : {})}
      >
        {children}
      </Pressable>
    </TooltipContext.Provider>
  );
}
