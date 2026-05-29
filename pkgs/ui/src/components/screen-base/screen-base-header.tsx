/**
 * App screen header: composes the {@link TopBar} primitive. Every screen
 * gets the same chrome height because `TopBar`'s content height is locked.
 *
 * Slot mapping:
 *   - `leading`  -> caller-supplied leading content + auto back button (mobile).
 *   - `center`   -> centered tabs (desktop) or page title (from breadcrumbs).
 *   - `trailing` -> inline action buttons + overflow ellipsis + headerEnd.
 */

import { useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBreakpoint, useTheme } from '../../theme';
import { BackIconButton } from '../back-icon-button';
import { Box } from '../box';
import { Button } from '../button';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import { TopBar } from '../top-bar';
import { partitionScreenActions } from './partition-screen-actions';
import type {
  ScreenBaseAction,
  ScreenBaseHeaderProps,
} from './screen-base-types';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer `useContext` over `useSafeAreaInsets` so monorepo Metro cannot bundle two copies of the library (mismatched context). */
function useSafeAreaInsetsCompat() {
  return useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
}

const DEFAULT_MENU_ICON = 'ellipsis' as const;

function actionToButtonProps(action: ScreenBaseAction): {
  title: ReactNode;
  onPress: () => void;
  intent: 'primary' | 'danger' | 'neutral';
  loading: boolean;
  disabled: boolean;
} {
  const { type, label, onPress, loading, disabled } = action;
  const base = {
    title: label,
    onPress,
    loading: loading ?? false,
    disabled: disabled ?? false,
  };
  switch (type) {
    case 'submit':
      return { ...base, intent: 'primary' as const };
    case 'destructive':
      return { ...base, intent: 'danger' as const };
    case 'secondary':
    case 'default':
    default:
      return { ...base, intent: 'neutral' as const };
  }
}

function buildOverflowMenuContent(
  overflow: ScreenBaseAction[],
  onClose: () => void,
  moreTitle: ReactNode
): FloatingMenuContent {
  const rows: FloatingMenuContent['rows'] = [];
  overflow.forEach((a, idx) => {
    rows.push({
      type: 'item',
      id: `overflow-${String(idx)}`,
      label: a.label,
      icon: a.icon ?? DEFAULT_MENU_ICON,
      trailing: a.trailing,
      onPress: () => {
        onClose();
        a.onPress();
      },
      disabled: a.disabled ?? false,
    });
    if (a.endsGroup === true) {
      rows.push({ type: 'divider', id: `overflow-div-${idx}` });
    }
  });

  return {
    header: { title: moreTitle },
    rows,
  };
}

type BreadcrumbItem = ScreenBaseHeaderProps['breadcrumbs'][number];

function HeaderTitle({ title }: { title: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      aria-level={1}
      numberOfLines={1}
      ellipsizeMode="tail"
      variant="navigationTitle"
      sx={{ textAlign: 'center' }}
      label={title}
    />
  );
}

/**
 * Renders the screen title as a semantic `<h1>` that is visually hidden
 * but still discoverable by screen readers and accessibility testers.
 * Used when `centerTabs` replaces the visible title so the page still
 * exposes a single top-level heading per WCAG 2.4.6 / 1.3.1.
 */
function VisuallyHiddenTitle({ title }: { title: ReactNode }) {
  if (title === undefined || title === null) return null;
  return (
    <Box
      pointerEvents="none"
      sx={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
    >
      <Text accessibilityRole="header" aria-level={1} label={title} />
    </Box>
  );
}

type TrailingProps = {
  inline: ScreenBaseAction[];
  hasOverflow: boolean;
  overflowTriggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  onOpenOverflow: () => void;
  headerEnd: ReactNode | undefined;
};

function HeaderTrailing({
  inline,
  hasOverflow,
  overflowTriggerRef,
  onOpenOverflow,
  headerEnd,
}: TrailingProps) {
  const theme = useTheme();
  if (
    inline.length === 0 &&
    !hasOverflow &&
    (headerEnd === undefined || headerEnd === null)
  ) {
    return null;
  }
  return (
    <>
      {inline.map((a, i) => {
        const bp = actionToButtonProps(a);
        return (
          <Button
            key={`inline-${String(i)}`}
            title={bp.title}
            onPress={bp.onPress}
            intent={bp.intent}
            size="sm"
            loading={bp.loading}
            disabled={bp.disabled}
          />
        );
      })}
      {hasOverflow ? (
        <Box ref={overflowTriggerRef} collapsable={false}>
          <IconButton size={36} onPress={onOpenOverflow}>
            <IconSymbol name="ellipsis" size={20} color={theme.colors.icon} />
          </IconButton>
        </Box>
      ) : null}
      {headerEnd}
    </>
  );
}

function useOverflowMenu(overflow: ScreenBaseAction[]) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<React.ElementRef<typeof Box>>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openOverflow = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const content = useMemo(
    () => buildOverflowMenuContent(overflow, close, t`More`),
    [overflow, close, t]
  );

  return { open, anchor, triggerRef, close, openOverflow, content };
}

function deriveBackCrumb(
  breadcrumbs: BreadcrumbItem[]
): BreadcrumbItem | undefined {
  return breadcrumbs.length >= 2
    ? breadcrumbs[breadcrumbs.length - 2]
    : undefined;
}

function deriveLayout(
  breadcrumbs: BreadcrumbItem[],
  centerTabs: ReactNode | undefined,
  isMobile: boolean
): {
  title: ReactNode | undefined;
  backCrumb: BreadcrumbItem | undefined;
  showBack: boolean;
  renderedCenterTabs: ReactNode | undefined;
} {
  const current = breadcrumbs[breadcrumbs.length - 1];
  const backCrumb = deriveBackCrumb(breadcrumbs);
  const renderedCenterTabs = !isMobile ? centerTabs : undefined;
  return {
    title: current?.name,
    backCrumb,
    showBack:
      isMobile && backCrumb !== undefined && backCrumb.onPress !== undefined,
    renderedCenterTabs,
  };
}

function renderCenterSlot(
  renderedCenterTabs: ReactNode | undefined,
  title: ReactNode | undefined
): ReactNode {
  if (renderedCenterTabs !== undefined) {
    return (
      <>
        <VisuallyHiddenTitle title={title} />
        {renderedCenterTabs}
      </>
    );
  }
  if (title !== undefined && title !== null) {
    return <HeaderTitle title={title} />;
  }
  return null;
}

export function ScreenBaseHeader({
  breadcrumbs,
  actions: actionsProp,
  centerTabs,
  headerEnd,
  leading: leadingProp,
}: ScreenBaseHeaderProps) {
  const insets = useSafeAreaInsetsCompat();
  const isMobile = useBreakpoint() === 'mobile';
  const { inline, overflow } = partitionScreenActions(
    actionsProp ?? [],
    isMobile
  );
  const menu = useOverflowMenu(overflow);
  const { title, backCrumb, showBack, renderedCenterTabs } = deriveLayout(
    breadcrumbs,
    centerTabs,
    isMobile
  );

  const onBack = () => {
    backCrumb?.onPress?.();
  };

  const leadingSlot = (
    <>
      {leadingProp}
      {showBack ? <BackIconButton size={36} onPress={onBack} /> : null}
    </>
  );

  const trailingSlot = (
    <HeaderTrailing
      inline={inline}
      hasOverflow={overflow.length > 0}
      overflowTriggerRef={menu.triggerRef}
      onOpenOverflow={menu.openOverflow}
      headerEnd={!isMobile ? headerEnd : undefined}
    />
  );

  return (
    <Box sx={{ background: 'surface', paddingTop: insets.top }}>
      <TopBar
        safeAreaTop={false}
        centerAlign="center"
        leading={leadingSlot}
        center={renderCenterSlot(renderedCenterTabs, title)}
        trailing={trailingSlot}
      />
      <FloatingMenu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.anchor}
        insets={{ top: insets.top, bottom: insets.bottom }}
        width={FLOATING_MENU_DEFAULT_WIDTH}
        content={menu.content}
      />
    </Box>
  );
}
