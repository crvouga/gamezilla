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
import { FloatingActionButton } from '../floating-action-button/floating-action-button';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScrollView } from '../scroll-view';
import { ScreenBaseContentHeader } from './screen-base-content-header';
import {
  ScreenBasePrimaryActionMutation,
  type ScreenBasePrimaryActionRenderProps,
} from './screen-base-primary-action';
import type {
  BodyContentProps,
  ScreenBaseBreadcrumb,
  ScreenBaseProps,
} from './screen-base-types';
import { ScreenBaseHeader } from './screen-base-header';

const MAX_CONTENT_WIDTH = 1120;
/** Spacing-scale steps (1 = 4px): body padding 16px, body gap 12px. */
const BODY_PADDING_STEP = 4;
const BODY_GAP_STEP = 3;
const SCROLL_BOTTOM_PADDING = 24;
const FLOATING_ACTION_MARGIN = 16;
const FLOATING_ACTION_Z_INDEX = 10;

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

function FloatingActionHost({
  children,
  extraBottomInset = 0,
}: {
  children: ReactNode;
  extraBottomInset?: number;
}) {
  const isMobile = useBreakpoint() === 'mobile';
  const bottomInset = useSafeAreaBottom();
  const bottom = isMobile
    ? FLOATING_ACTION_MARGIN + extraBottomInset
    : bottomInset + FLOATING_ACTION_MARGIN + extraBottomInset;
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

function pageTitleFromBreadcrumbs(
  breadcrumbs: ScreenBaseBreadcrumb[]
): ReactNode | undefined {
  return breadcrumbs[breadcrumbs.length - 1]?.name;
}

function renderPrimaryActionFab(
  props: ScreenBasePrimaryActionRenderProps
): ReactNode {
  return (
    <FloatingActionButton {...props.fabProps} icon={props.icon ?? 'plus'} />
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
  primaryAction,
  primaryActionBottomInset = 0,
}: ScreenBaseProps) {
  const isWide = useBreakpoint() !== 'mobile';
  const inlineFooter = footer !== undefined && isWide;
  const pinnedFooter = footer !== undefined && !isWide;
  const pageTitle = pageTitleFromBreadcrumbs(breadcrumbs);

  const body = (primaryActionProps?: ScreenBasePrimaryActionRenderProps) =>
    renderScreenBody({
      scroll,
      keyboardAvoiding,
      content,
      inlineFooter,
      pinnedFooter,
      footer,
      isWide,
      pageTitle,
      primaryActionProps,
      primaryActionBottomInset,
    });

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs}
        actions={actions ?? []}
        centerTabs={centerTabs}
        headerEnd={headerEnd}
        leading={leading}
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

function renderWideContentHeader(
  pageTitle: ReactNode | undefined,
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined
): ReactNode {
  if (
    primaryActionProps === undefined ||
    pageTitle === undefined ||
    pageTitle === null
  ) {
    return null;
  }
  return (
    <ScreenBaseContentHeader
      title={pageTitle}
      buttonProps={primaryActionProps.buttonProps}
      icon={primaryActionProps.icon}
    />
  );
}

function renderConstrainedBody(args: {
  content: ScreenBaseProps['content'];
  inlineFooter: boolean;
  footer: ScreenBaseProps['footer'];
  isWide: boolean;
  pageTitle: ReactNode | undefined;
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
}): ReactNode {
  return (
    <ConstrainedInner>
      {args.isWide
        ? renderWideContentHeader(args.pageTitle, args.primaryActionProps)
        : null}
      {args.content({ sx: { flex: 1 } } satisfies BodyContentProps)}
      {args.inlineFooter ? (
        <Box sx={{ pt: BODY_GAP_STEP }}>{args.footer}</Box>
      ) : null}
    </ConstrainedInner>
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
  inlineFooter: boolean;
  pinnedFooter: boolean;
  footer: ScreenBaseProps['footer'];
  isWide: boolean;
  pageTitle: ReactNode | undefined;
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
}): ReactNode {
  const inner = renderConstrainedBody(args);
  const body = renderScrollableBody(args.scroll, inner);

  const bodyWithFooter = (
    <Box sx={{ flex: 1, minHeight: 0 }} style={{ position: 'relative' }}>
      {body}
      {args.pinnedFooter ? <PinnedFooter>{args.footer}</PinnedFooter> : null}
      {!args.isWide && args.primaryActionProps !== undefined ? (
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
