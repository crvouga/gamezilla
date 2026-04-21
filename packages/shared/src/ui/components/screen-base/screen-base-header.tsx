/**
 * App screen header: safe area, breadcrumbs, title from last crumb, actions + overflow.
 */

import {
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBreakpoint, useTheme } from '../../theme';
import { Box } from '../box';
import { Button } from '../button';
import { Pressable } from '../pressable';
import {
  FloatingMenu,
  FLOATING_MENU_DEFAULT_WIDTH,
  type FloatingMenuContent,
} from '../floating-menu';
import { IconButton } from '../icon-button';
import { IconSymbol } from '../symbol-icon';
import { Text } from '../text';
import { partitionScreenActions } from './partition-screen-actions';
import type { ScreenBaseAction, ScreenBaseHeaderProps } from './screen-base-types';

const BAR_CONTENT_HEIGHT = 58;
const TITLE_SIDE_GUTTER = 80;

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer `useContext` over `useSafeAreaInsets` so monorepo Metro cannot bundle two copies of the library (mismatched context). */
function useSafeAreaInsetsCompat() {
  return useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
}

const DEFAULT_MENU_ICON = 'ellipsis' as const;

function actionToButtonProps(action: ScreenBaseAction): {
  title: string;
  onPress: () => void;
  variant: 'solid' | 'outlined' | 'ghost' | 'text';
  color: string;
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
      return { ...base, variant: 'solid' as const, color: 'tint' };
    case 'destructive':
      return { ...base, variant: 'solid' as const, color: 'destructive' };
    case 'secondary':
      return { ...base, variant: 'outlined' as const, color: 'tint' };
    case 'default':
    default:
      return { ...base, variant: 'text' as const, color: 'tint' };
  }
}

function buildOverflowMenuContent(
  overflow: ScreenBaseAction[],
  onClose: () => void
): FloatingMenuContent {
  const rows: FloatingMenuContent['rows'] = [];
  overflow.forEach((a, idx) => {
    rows.push({
      type: 'item',
      id: `overflow-${idx}-${a.label}`,
      label: a.label,
      icon: a.icon ?? DEFAULT_MENU_ICON,
      trailing: a.trailing,
      onPress: () => {
        onClose();
        a.onPress();
      },
      disabled: a.disabled ?? false,
      accessibilityLabel: a.label,
    });
    if (a.endsGroup === true) {
      rows.push({ type: 'divider', id: `overflow-div-${idx}` });
    }
  });

  return {
    header: { title: 'More' },
    rows,
  };
}

export function ScreenBaseHeader({
  breadcrumbs,
  actions: actionsProp,
}: ScreenBaseHeaderProps) {
  const actions = actionsProp ?? [];
  const insets = useSafeAreaInsetsCompat();
  const theme = useTheme();
  const isMobile = useBreakpoint() === 'mobile';
  const { inline, overflow } = partitionScreenActions(actions, isMobile);

  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowTriggerRef = useRef<React.ElementRef<typeof Box>>(null);
  const [overflowAnchor, setOverflowAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const closeOverflow = useCallback(() => {
    setOverflowOpen(false);
    setOverflowAnchor(null);
  }, []);

  const openOverflow = useCallback(() => {
    overflowTriggerRef.current?.measureInWindow((x, y, width, height) => {
      setOverflowAnchor({ x, y, width, height });
      setOverflowOpen(true);
    });
  }, []);

  const overflowContent = useMemo(
    () => buildOverflowMenuContent(overflow, closeOverflow),
    [overflow, closeOverflow]
  );

  const current = breadcrumbs[breadcrumbs.length - 1];
  const title = current?.name ?? '';
  const subtitle =
    current?.subtitle !== undefined && current?.subtitle !== ''
      ? current.subtitle
      : undefined;
  const hasSubtitle = subtitle !== undefined;

  const backCrumb =
    breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : undefined;
  const showBack =
    isMobile && backCrumb !== undefined && backCrumb.onPress !== undefined;

  const onBackPress = () => {
    backCrumb?.onPress?.();
  };

  const backLabel =
    backCrumb !== undefined ? `\u2190 ${backCrumb.name}` : 'Back';

  return (
    <Box
      sx={{
        background: 'paper',
        borderBottomWidth: 1,
        borderColor: 'border',
        paddingTop: insets.top,
      }}
    >
      {!isMobile && breadcrumbs.length > 0 ? (
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
          {breadcrumbs.map((c, i) => {
            const isLast = i === breadcrumbs.length - 1;
            return (
              <Fragment key={`${c.name}-${i}`}>
                {i > 0 ? (
                  <Text
                    variant="caption"
                    sx={{ color: 'textSecondary' }}
                    label="/"
                  />
                ) : null}
                {isLast ? (
                  <Text variant="caption" sx={{ color: 'textSecondary' }} label={c.name} />
                ) : c.onPress !== undefined ? (
                  <Pressable onPress={c.onPress} hitSlop={4}>
                    <Text variant="caption" sx={{ color: 'tint' }} label={c.name} />
                  </Pressable>
                ) : (
                  <Text variant="caption" sx={{ color: 'textSecondary' }} label={c.name} />
                )}
              </Fragment>
            );
          })}
        </Box>
      ) : null}

      <Box
        sx={{
          position: 'relative',
          minHeight: BAR_CONTENT_HEIGHT,
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            alignSelf: 'stretch',
            paddingHorizontal: TITLE_SIDE_GUTTER,
            gap: 0.5,
          }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            variant="navigationTitle"
            sx={{ textAlign: 'center' }}
            label={title}
          />
          {hasSubtitle ? (
            <Text
              variant="caption"
              numberOfLines={2}
              ellipsizeMode="tail"
              sx={{ textAlign: 'center' }}
              label={subtitle}
            />
          ) : null}
        </Box>

        {showBack ? (
          <Pressable
            onPress={onBackPress}
            accessibilityRole="button"
            accessibilityLabel="Go back"
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
            <Text variant="label" sx={{ color: 'tint' }} label={backLabel} />
          </Pressable>
        ) : null}

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
                key={`inline-${i}-${a.label}`}
                title={bp.title}
                onPress={bp.onPress}
                variant={bp.variant}
                color={bp.color}
                size="sm"
                loading={bp.loading}
                disabled={bp.disabled}
              />
            );
          })}
          {overflow.length > 0 ? (
            <Box ref={overflowTriggerRef} collapsable={false}>
              <IconButton size={36} onPress={openOverflow}>
                <IconSymbol
                  name="ellipsis"
                  size={20}
                  color={theme.colors.icon}
                />
              </IconButton>
            </Box>
          ) : null}
        </Box>
      </Box>

      <FloatingMenu
        open={overflowOpen}
        onClose={closeOverflow}
        anchor={overflowAnchor}
        insets={{ top: insets.top, bottom: insets.bottom }}
        width={FLOATING_MENU_DEFAULT_WIDTH}
        content={overflowContent}
      />
    </Box>
  );
}
