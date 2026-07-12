/**
 * Full screen shell: header + constrained body + optional scroll / keyboard
 * avoiding. The header bar always renders at the locked
 * {@link TOP_BAR_CONTENT_HEIGHT}, so every screen's top chrome lines up to
 * the same baseline.
 */

import { useContext, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Box } from '../box';
import { FloatingActionButton } from '../floating-action-button/floating-action-button';
import { PlusIcon } from '../icons';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScrollView } from '../scroll-view';
import {
  ScreenBasePrimaryActionMutation,
  type ScreenBasePrimaryActionRenderProps,
} from './screen-base-primary-action';
import type { BodyContentProps, ScreenBaseProps } from './screen-base-types';
import { ScreenBaseHeader } from './screen-base-header';

/** Spacing-scale steps (1 = 4px): body padding 16px, body gap 12px. */
const BODY_PADDING_STEP = 4;
const BODY_GAP_STEP = 3;
const SCROLL_BOTTOM_PADDING = 24;
const FLOATING_ACTION_MARGIN = 16;
const FLOATING_ACTION_Z_INDEX = 10;

function BodyInner({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ flex: 1, p: BODY_PADDING_STEP, gap: BODY_GAP_STEP }}>
      {children}
    </Box>
  );
}

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** See note in `screen-base-header.tsx`: prefer context over the hook so Metro cannot bundle two copies. */
function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

/** Bottom-pinned footer: full-bleed surface with a top divider. */
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

function FloatingActionHost({
  children,
  extraBottomInset = 0,
}: {
  children: ReactNode;
  extraBottomInset?: number;
}) {
  const bottom = FLOATING_ACTION_MARGIN + extraBottomInset;
  return (
    <Box
      style={{
        position: 'absolute',
        right: FLOATING_ACTION_MARGIN,
        bottom,
        zIndex: FLOATING_ACTION_Z_INDEX,
      }}
    >
      {children}
    </Box>
  );
}

function renderPrimaryActionFab(
  props: ScreenBasePrimaryActionRenderProps
): ReactNode {
  return (
    <FloatingActionButton {...props.fabProps} icon={props.icon ?? PlusIcon} />
  );
}

export function ScreenBase({
  breadcrumbs,
  actions,
  content,
  scroll = false,
  keyboardAvoiding = false,
  leading,
  footer,
  primaryAction,
  primaryActionBottomInset = 0,
  accountMenu,
}: ScreenBaseProps) {
  const body = (primaryActionProps?: ScreenBasePrimaryActionRenderProps) =>
    renderScreenBody({
      scroll,
      keyboardAvoiding,
      content,
      footer,
      primaryActionProps,
      primaryActionBottomInset,
    });

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs}
        actions={actions ?? []}
        leading={leading}
        accountMenu={accountMenu}
      />
      {primaryAction !== undefined ? (
        <ScreenBasePrimaryActionMutation config={primaryAction}>
          {(primaryActionProps) => body(primaryActionProps)}
        </ScreenBasePrimaryActionMutation>
      ) : (
        body(undefined)
      )}
    </Box>
  );
}

function renderConstrainedBody(args: {
  content: ScreenBaseProps['content'];
}): ReactNode {
  return (
    <BodyInner>
      {args.content({ sx: { flex: 1 } } satisfies BodyContentProps)}
    </BodyInner>
  );
}

function renderScrollableBody(scroll: boolean, inner: ReactNode): ReactNode {
  if (scroll) {
    return (
      <ScrollView
        sx={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: SCROLL_BOTTOM_PADDING,
        }}
      >
        {inner}
      </ScrollView>
    );
  }
  return <Box sx={{ flex: 1 }}>{inner}</Box>;
}

function renderScreenBody(args: {
  scroll: boolean;
  keyboardAvoiding: boolean;
  content: ScreenBaseProps['content'];
  footer: ScreenBaseProps['footer'];
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
}): ReactNode {
  const inner = renderConstrainedBody(args);
  const body = renderScrollableBody(args.scroll, inner);

  const bodyWithFooter = (
    <Box sx={{ flex: 1, minHeight: 0 }} style={{ position: 'relative' }}>
      {body}
      {args.footer !== undefined ? (
        <PinnedFooter>{args.footer}</PinnedFooter>
      ) : null}
      {args.primaryActionProps !== undefined &&
      !args.primaryActionProps.buttonProps.disabled ? (
        <FloatingActionHost extraBottomInset={args.primaryActionBottomInset}>
          {renderPrimaryActionFab(args.primaryActionProps)}
        </FloatingActionHost>
      ) : null}
    </Box>
  );

  if (args.keyboardAvoiding) {
    return (
      <KeyboardAvoidingView sx={{ flex: 1 }}>
        {bodyWithFooter}
      </KeyboardAvoidingView>
    );
  }
  return bodyWithFooter;
}
