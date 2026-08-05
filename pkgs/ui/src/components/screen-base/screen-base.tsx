/**
 * Full screen shell: header + constrained body + optional scroll / keyboard
 * avoiding. The header bar always renders at the locked
 * {@link TOP_BAR_CONTENT_HEIGHT}, so every screen's top chrome lines up to
 * the same baseline.
 *
 * Body scrollbars must sit flush with the screen edge:
 * - Whole-body scroll → pass `scroll` (padding lives inside the scroller).
 * - Sticky chrome + nested list → use {@link ScreenBodyScrollView} /
 *   {@link ScreenBodyFlatList}; the body provides
 *   {@link ContentEdgePaddingProvider} so nested scrollers bleed under
 *   horizontal padding automatically.
 */

import { useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Box } from '../box';
import { componentDataSet } from '../../component-id';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { FloatingActionButton } from '../floating-action-button/floating-action-button';
import { PlusIcon } from '../icons';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { ScrollView } from '../scroll-view';
import {
  ScreenBasePrimaryActionMutation,
  type ScreenBasePrimaryActionRenderProps,
} from './screen-base-primary-action';
import { SCREEN_BODY_PADDING_STEP } from './screen-body-padding';
import type { BodyContentProps, ScreenBaseProps } from './screen-base-types';
import { ScreenBaseHeader } from './screen-base-header';

/** Spacing-scale steps (1 = 4px): body gap 12px. */
const BODY_GAP_STEP = 3;
const SCROLL_BOTTOM_PADDING = 24;
const FLOATING_ACTION_MARGIN = 16;
const FLOATING_ACTION_Z_INDEX = 10;

function BodyInner({
  children,
  scroll,
}: {
  children: ReactNode;
  scroll: boolean;
}) {
  return (
    <ContentEdgePaddingProvider
      step={SCREEN_BODY_PADDING_STEP}
      bottomStep={SCREEN_BODY_PADDING_STEP}
    >
      <Box
        sx={{
          ...(scroll ? {} : { flex: 1, minHeight: 0 }),
          p: SCREEN_BODY_PADDING_STEP,
          gap: BODY_GAP_STEP,
        }}
      >
        {children}
      </Box>
    </ContentEdgePaddingProvider>
  );
}

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** See note in `screen-base-header.tsx`: prefer context over the hook so Metro cannot bundle two copies. */
function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

/** Scroll inset below body content; footer screens only need breathing room. */
function scrollContentPaddingBottom(
  bottomInset: number,
  hasFooter: boolean
): number {
  if (hasFooter) {
    return SCROLL_BOTTOM_PADDING;
  }
  return SCROLL_BOTTOM_PADDING + bottomInset;
}

/** Bottom-pinned footer: full-bleed surface with a top divider. */
function PinnedFooter({ children }: { children: ReactNode }) {
  const bottomInset = useSafeAreaBottom();
  return (
    <Box
      sx={{
        background: 'surface',
        borderColor: 'border',
        px: SCREEN_BODY_PADDING_STEP,
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
  screenId,
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
  dataSet,
}: ScreenBaseProps) {
  const body = (primaryActionProps?: ScreenBasePrimaryActionRenderProps) => (
    <ScreenBody
      scroll={scroll}
      keyboardAvoiding={keyboardAvoiding}
      content={content}
      footer={footer}
      primaryActionProps={primaryActionProps}
      primaryActionBottomInset={primaryActionBottomInset}
    />
  );

  return (
    <Box
      sx={{ flex: 1 }}
      testID={`screen-${screenId}`}
      {...componentDataSet('ScreenBase', { ...dataSet, screen: screenId })}
    >
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
  scroll: boolean;
  content: ScreenBaseProps['content'];
}): ReactNode {
  return (
    <BodyInner scroll={args.scroll}>
      {args.content({
        sx: args.scroll ? {} : { flex: 1, minHeight: 0 },
      } satisfies BodyContentProps)}
    </BodyInner>
  );
}

function renderScrollableBody(
  scroll: boolean,
  inner: ReactNode,
  paddingBottom: number
): ReactNode {
  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom,
        }}
      >
        {inner}
      </ScrollView>
    );
  }
  return <Box sx={{ flex: 1, minHeight: 0 }}>{inner}</Box>;
}

function ScreenBody({
  scroll,
  keyboardAvoiding,
  content,
  footer,
  primaryActionProps,
  primaryActionBottomInset,
}: {
  scroll: boolean;
  keyboardAvoiding: boolean;
  content: ScreenBaseProps['content'];
  footer: ScreenBaseProps['footer'];
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
}): ReactNode {
  const bottomInset = useSafeAreaBottom();
  const hasFooter = footer !== undefined;
  const scrollPaddingBottom = useMemo(
    () => scrollContentPaddingBottom(bottomInset, hasFooter),
    [bottomInset, hasFooter]
  );
  const inner = renderConstrainedBody({ scroll, content });
  const body = renderScrollableBody(scroll, inner, scrollPaddingBottom);

  const bodyWithFooter = (
    <Box
      sx={{ flex: 1, minHeight: 0 }}
      style={{
        position: 'relative',
        ...(hasFooter || scroll ? {} : { paddingBottom: bottomInset }),
      }}
    >
      {body}
      {footer !== undefined ? <PinnedFooter>{footer}</PinnedFooter> : null}
      {primaryActionProps !== undefined &&
      !primaryActionProps.buttonProps.disabled ? (
        <FloatingActionHost extraBottomInset={primaryActionBottomInset}>
          {renderPrimaryActionFab(primaryActionProps)}
        </FloatingActionHost>
      ) : null}
    </Box>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView sx={{ flex: 1 }}>
        {bodyWithFooter}
      </KeyboardAvoidingView>
    );
  }
  return bodyWithFooter;
}
