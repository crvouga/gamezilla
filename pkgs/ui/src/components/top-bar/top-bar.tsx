/**
 * `TopBar` -- app-agnostic horizontal navigation bar with slot layout.
 *
 * Composes three slots: `leading`, `center`, and `trailing`. The center slot
 * is flex-stretched between the two edges; consumers control internal
 * alignment with `centerAlign`. Background, border, and safe-area inset come
 * from the active theme so the bar matches surrounding chrome out of the box.
 *
 * @example
 * ```tsx
 * <TopBar
 *   safeAreaTop
 *   leading={<BackIconButton onPress={onBack} />}
 *   center={<Text variant="bodyBold" label="Settings" />}
 *   trailing={<OverflowMenuButton actions={menu} header={{ title: 'More' }} />}
 * />
 * ```
 */

import { useContext, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Box } from '../box';

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
  /** When true, applies the safe-area top inset above the bar. */
  safeAreaTop?: boolean;
  /** Minimum bar height in px. Defaults to 64 to match the rest of chrome. */
  minHeight?: number;
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
  safeAreaTop = false,
  minHeight = 64,
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
          py: 2,
          px: 3,
          minHeight,
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
