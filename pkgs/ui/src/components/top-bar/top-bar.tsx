/**
 * `TopBar` -- app-agnostic horizontal navigation bar with slot layout.
 *
 * Composes three slots: `leading`, `center`, and `trailing`. The center slot
 * is flex-stretched between the two edges; consumers control internal
 * alignment with `centerAlign`. Background, border, and safe-area inset come
 * from the active theme so the bar matches surrounding chrome out of the box.
 *
 * The inner row height is locked to {@link TOP_BAR_CONTENT_HEIGHT} -- 56pt,
 * matching the iOS large-tap-target convention and the modal action button
 * size. Height is a load-bearing system constant, not a per-call-site choice,
 * so every screen's top chrome lines up to the same baseline.
 *
 * @example
 * ```tsx
 * <TopBar
 *   leading={<BackIconButton onPress={onBack} />}
 *   center={<Text variant="bodyBold" label="Settings" />}
 *   trailing={<OverflowMenuButton actions={menu} header={{ title: 'More' }} />}
 * />
 * ```
 */

import { useContext, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Box } from '../box';

/**
 * Inner content height of the top bar (excluding the safe-area inset).
 * Exposed so screens can reserve matching space (sticky headers,
 * keyboard-aware insets, etc.) without re-encoding the magic number.
 */
export const TOP_BAR_CONTENT_HEIGHT = 56;

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Mirrors {@link ScreenBaseHeader}: avoids tearing when monorepo Metro bundles two copies of `react-native-safe-area-context`. */
function useTopBarTopInset(safeAreaTop: boolean): number {
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA;
  return safeAreaTop ? insets.top : 0;
}

export type TopBarCenterAlign = 'start' | 'center' | 'end';

export type TopBarProps = {
  /** Slot pinned to the left edge (typically back/home + identity). */
  leading?: ReactNode;
  /** Slot stretched between leading and trailing. */
  center?: ReactNode;
  /** Slot pinned to the right edge (typically actions + overflow). */
  trailing?: ReactNode;
  /** Cross-axis alignment for the center slot. Defaults to `'start'`. */
  centerAlign?: TopBarCenterAlign;
  /**
   * When true, applies the safe-area top inset above the bar. Defaults to
   * `true` -- the bar is a screen-level surface that must clear the system
   * status bar. Opt out only when the bar is composed below something that
   * already consumes the inset.
   */
  safeAreaTop?: boolean;
};

const ALIGN_MAP: Record<
  TopBarCenterAlign,
  'flex-start' | 'center' | 'flex-end'
> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

export function TopBar({
  leading,
  center,
  trailing,
  centerAlign = 'start',
  safeAreaTop = true,
}: TopBarProps): ReactNode {
  const paddingTop = useTopBarTopInset(safeAreaTop);

  return (
    <Box
      sx={{
        background: 'surface',
        borderBottomWidth: 1,
        borderColor: 'border',
        paddingTop,
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          px: 3,
          height: TOP_BAR_CONTENT_HEIGHT,
        }}
      >
        {leading !== undefined ? (
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {leading}
          </Box>
        ) : null}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: ALIGN_MAP[centerAlign],
          }}
        >
          {center}
        </Box>
        {trailing !== undefined ? (
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {trailing}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
