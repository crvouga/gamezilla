/**
 * App screen header: safe area, breadcrumbs, title from last crumb, actions + overflow.
 */

import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import {
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBreakpoint, useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import { Pressable } from '../pressable';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import { partitionScreenActions } from './partition-screen-actions';
import type {
  ScreenBaseAction,
  ScreenBaseHeaderProps,
} from './screen-base-types';

const BAR_CONTENT_HEIGHT = 58;
const TITLE_SIDE_GUTTER = 80;

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer `useContext` over `useSafeAreaInsets` so monorepo Metro cannot bundle two copies of the library (mismatched context). `useSafeAreaInsets` throws when the context is null, which defeats the fallback. */
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

function BreadcrumbCell({
  crumb,
  isLast,
}: {
  crumb: BreadcrumbItem;
  isLast: boolean;
}) {
  if (isLast) {
    return (
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={crumb.name}
      />
    );
  }
  if (crumb.onPress !== undefined) {
    return (
      <Pressable onPress={crumb.onPress} hitSlop={4}>
        <Text variant="caption" sx={{ color: 'tint' }} label={crumb.name} />
      </Pressable>
    );
  }
  return (
    <Text
      variant="caption"
      sx={{ color: 'textSecondary' }}
      label={crumb.name}
    />
  );
}

function BreadcrumbsBar({ breadcrumbs }: { breadcrumbs: BreadcrumbItem[] }) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        px: 4,
        pt: 3,
        pb: 1,
      }}
    >
      {breadcrumbs.map((c, i) => (
        <Fragment key={`breadcrumb-${String(i)}`}>
          {i > 0 ? (
            <Text variant="caption" sx={{ color: 'textSecondary' }} label="/" />
          ) : null}
          <BreadcrumbCell crumb={c} isLast={i === breadcrumbs.length - 1} />
        </Fragment>
      ))}
    </Box>
  );
}

function TitleArea({
  title,
  subtitle,
}: {
  title: ReactNode | undefined;
  subtitle?: ReactNode;
}) {
  return (
    <Box
      sx={{
        alignItems: 'center',
        alignSelf: 'stretch',
        paddingHorizontal: TITLE_SIDE_GUTTER,
        gap: 0.5,
      }}
    >
      {title !== undefined && title !== null ? (
        <Text
          accessibilityRole="header"
          aria-level={1}
          numberOfLines={1}
          ellipsizeMode="tail"
          variant="navigationTitle"
          sx={{ textAlign: 'center' }}
          label={title}
        />
      ) : null}
      {subtitle !== undefined ? (
        <Text
          variant="caption"
          numberOfLines={2}
          ellipsizeMode="tail"
          sx={{ textAlign: 'center' }}
          label={subtitle}
        />
      ) : null}
    </Box>
  );
}

function BackButton({
  label,
  onPress,
}: {
  label: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t`Go back`}
      hitSlop={8}
      sx={{
        position: 'absolute',
        left: 12,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        zIndex: 1,
      }}
    >
      <Text variant="label" sx={{ color: 'tint' }} label={label} />
    </Pressable>
  );
}

function ActionsBar({
  inline,
  hasOverflow,
  overflowTriggerRef,
  onOpenOverflow,
}: {
  inline: ScreenBaseAction[];
  hasOverflow: boolean;
  overflowTriggerRef: React.RefObject<React.ElementRef<typeof Box> | null>;
  onOpenOverflow: () => void;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'absolute',
        right: 8,
        top: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        zIndex: 2,
        maxWidth: 280,
      }}
    >
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
    </Box>
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

function deriveTitleData(breadcrumbs: BreadcrumbItem[]) {
  const current = breadcrumbs[breadcrumbs.length - 1];
  const subtitle =
    current?.subtitle !== undefined && current?.subtitle !== null
      ? current.subtitle
      : undefined;
  const backCrumb =
    breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : undefined;
  return { title: current?.name, subtitle, backCrumb };
}

export function ScreenBaseHeader({
  breadcrumbs,
  actions: actionsProp,
}: ScreenBaseHeaderProps) {
  const actions = actionsProp ?? [];
  const insets = useSafeAreaInsetsCompat();
  const isMobile = useBreakpoint() === 'mobile';
  const { inline, overflow } = partitionScreenActions(actions, isMobile);
  const menu = useOverflowMenu(overflow);
  const { title, subtitle, backCrumb } = deriveTitleData(breadcrumbs);
  const showBack =
    isMobile && backCrumb !== undefined && backCrumb.onPress !== undefined;
  const backLabel: ReactNode =
    backCrumb !== undefined ? (
      <>
        {'\u2190 '}
        {backCrumb.name}
      </>
    ) : (
      t`Back`
    );

  return (
    <Box
      sx={{
        background: 'surface',
        borderBottomWidth: 1,
        borderColor: 'border',
        paddingTop: insets.top,
      }}
    >
      {!isMobile && breadcrumbs.length > 0 ? (
        <BreadcrumbsBar breadcrumbs={breadcrumbs} />
      ) : null}
      <Box
        sx={{
          position: 'relative',
          minHeight: BAR_CONTENT_HEIGHT,
          justifyContent: 'center',
        }}
      >
        <TitleArea
          title={title}
          {...(subtitle !== undefined ? { subtitle } : {})}
        />
        {showBack ? (
          <BackButton
            label={backLabel}
            onPress={() => backCrumb?.onPress?.()}
          />
        ) : null}
        <ActionsBar
          inline={inline}
          hasOverflow={overflow.length > 0}
          overflowTriggerRef={menu.triggerRef}
          onOpenOverflow={menu.openOverflow}
        />
      </Box>
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
