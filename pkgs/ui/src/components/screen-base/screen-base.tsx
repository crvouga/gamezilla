/**
 * Full screen shell: header + constrained body + optional scroll / keyboard
 * avoiding. The header bar always renders at the locked
 * {@link TOP_BAR_CONTENT_HEIGHT}, so every screen's top chrome lines up to
 * the same baseline.
 */

import type { ReactNode } from 'react';

import { useTheme } from '../../theme';
import { Box } from '../box';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScrollView } from '../scroll-view';
import type { BodyContentProps, ScreenBaseProps } from './screen-base-types';
import { ScreenBaseHeader } from './screen-base-header';

const MAX_CONTENT_WIDTH = 1120;
const BODY_PADDING = 16;
const BODY_GAP = 12;
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
        padding: BODY_PADDING,
        gap: BODY_GAP,
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

export function ScreenBase({
  breadcrumbs,
  actions,
  content,
  scroll = false,
  keyboardAvoiding = false,
  centerTabs,
  headerEnd,
  leading,
}: ScreenBaseProps) {
  const inner = (
    <ConstrainedInner>
      {content({ sx: { flex: 1 } } satisfies BodyContentProps)}
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

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView sx={{ flex: 1 }}>{body}</KeyboardAvoidingView>
  ) : (
    body
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
