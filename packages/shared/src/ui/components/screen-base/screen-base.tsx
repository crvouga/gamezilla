/**
 * Full screen shell: header + constrained body + optional scroll / keyboard avoiding.
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

function ConstrainedBody({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const wide = theme.breakpoint !== 'mobile';

  return (
    <Box
      sx={{
        flex: 1,
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
}: ScreenBaseProps) {
  const body = scroll ? (
    <ScrollView
      sx={{ flex: 1 }}
      contentContainerStyle={{
        padding: BODY_PADDING,
        gap: BODY_GAP,
        paddingBottom: BODY_PADDING + SCROLL_BOTTOM_PADDING,
        flexGrow: 1,
      }}
    >
      {content({ sx: { flex: 1 } } satisfies BodyContentProps)}
    </ScrollView>
  ) : (
    <Box sx={{ flex: 1, padding: BODY_PADDING, gap: BODY_GAP }}>
      {content({ sx: { flex: 1 } } satisfies BodyContentProps)}
    </Box>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView sx={{ flex: 1 }}>{body}</KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={breadcrumbs} actions={actions ?? []} />
      <ConstrainedBody>{wrapped}</ConstrainedBody>
    </Box>
  );
}
