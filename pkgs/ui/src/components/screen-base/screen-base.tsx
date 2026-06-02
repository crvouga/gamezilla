/**
 * Full screen shell: header + constrained body + optional scroll / keyboard
 * avoiding. The header bar always renders at the locked
 * {@link TOP_BAR_CONTENT_HEIGHT}, so every screen's top chrome lines up to
 * the same baseline.
 */

import { useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useBreakpoint, useTheme } from '../../theme';
import { Box } from '../box';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScrollView } from '../scroll-view';
import type { BodyContentProps, ScreenBaseProps } from './screen-base-types';
import { ScreenBaseHeader } from './screen-base-header';

const MAX_CONTENT_WIDTH = 1120;
/** Spacing-scale steps (1 = 4px): body padding 16px, body gap 12px. */
const BODY_PADDING_STEP = 4;
const BODY_GAP_STEP = 3;
const SCROLL_BOTTOM_PADDING = 24;

/**
 * Centers content up to {@link MAX_CONTENT_WIDTH} while always letting the
 * parent (ScrollView / full-bleed container) span the full viewport.
 */
function ConstrainedInner({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const wide = theme.breakpoint !== 'mobile';

  return (
    <Box
      sx={{
        flex: 1,
        p: BODY_PADDING_STEP,
        gap: BODY_GAP_STEP,
        ...(wide
          ? { alignSelf: 'center' as const, maxWidth: MAX_CONTENT_WIDTH }
          : {}),
      }}
      style={{ width: '100%' }}
    >
      {children}
    </Box>
  );
}

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** See note in `screen-base-header.tsx`: prefer context over the hook so Metro cannot bundle two copies. */
function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

/** Bottom-pinned footer (mobile): full-bleed surface with a top divider. */
function PinnedFooter({ children }: { children: ReactNode }) {
  const bottomInset = useSafeAreaBottom();
  return (
    <Box
      sx={{
        background: 'surface',
        borderColor: 'border',
        px: BODY_PADDING_STEP,
        pt: BODY_GAP_STEP,
      }}
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingBottom: bottomInset + SCROLL_BOTTOM_PADDING / 2,
      }}
    >
      {children}
    </Box>
  );
}

export function ScreenBase({
  breadcrumbs,
  actions,
  content,
  scroll = false,
  keyboardAvoiding = false,
  centerTabs,
  headerEnd,
  leading,
  footer,
}: ScreenBaseProps) {
  const isWide = useBreakpoint() !== 'mobile';
  const inlineFooter = footer !== undefined && isWide;
  const pinnedFooter = footer !== undefined && !isWide;

  const inner = (
    <ConstrainedInner>
      {content({ sx: { flex: 1 } } satisfies BodyContentProps)}
      {inlineFooter ? <Box sx={{ pt: BODY_GAP_STEP }}>{footer}</Box> : null}
    </ConstrainedInner>
  );

  const body = scroll ? (
    <ScrollView
      sx={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: SCROLL_BOTTOM_PADDING,
      }}
    >
      {inner}
    </ScrollView>
  ) : (
    <Box sx={{ flex: 1 }}>{inner}</Box>
  );

  const bodyWithFooter = (
    <Box sx={{ flex: 1 }}>
      {body}
      {pinnedFooter ? <PinnedFooter>{footer}</PinnedFooter> : null}
    </Box>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView sx={{ flex: 1 }}>
      {bodyWithFooter}
    </KeyboardAvoidingView>
  ) : (
    bodyWithFooter
  );

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs}
        actions={actions ?? []}
        centerTabs={centerTabs}
        headerEnd={headerEnd}
        leading={leading}
      />
      {wrapped}
    </Box>
  );
}
