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
 *
 * Pass `largeTitle` for a body heading that reveals in the TopBar after scroll.
 */

import { type ReactElement, type ReactNode, useContext, useMemo } from 'react';
import type { RefreshControlProps } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { componentDataSet } from '../../component-id';
import { useAppFrameGlobalTrailing } from '../app-frame/app-frame-chrome';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { FloatingActionButton } from '../floating-action-button/floating-action-button';
import { PlusIcon } from '../icons';
import { KeyboardAvoidingView } from '../keyboard-avoiding-view';
import { useResolvedRefreshControl } from '../pull-to-refresh';
import {
  ScreenLargeTitle,
  ScreenTitleProvider,
  type ScreenTitleScrollProps,
  useScreenTitleScroll,
} from '../screen-title';
import { ScrollView } from '../scroll-view';
import { ScreenBaseHeader } from './screen-base-header';
import {
  ScreenBasePrimaryActionMutation,
  type ScreenBasePrimaryActionRenderProps,
} from './screen-base-primary-action';
import type { BodyContentProps, ScreenBaseProps } from './screen-base-types';
import { SCREEN_BODY_PADDING_STEP } from './screen-body-padding';

/** Spacing-scale steps (1 = 4px): body gap 12px. */
const BODY_GAP_STEP = 3;
const SCROLL_BOTTOM_PADDING = 24;
const FLOATING_ACTION_MARGIN = 16;
const FLOATING_ACTION_Z_INDEX = 10;

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

function BodyInner({
  children,
  scroll,
  largeTitle,
}: {
  children: ReactNode;
  scroll: boolean;
  largeTitle: boolean;
}) {
  return (
    <ContentEdgePaddingProvider
      step={SCREEN_BODY_PADDING_STEP}
      bottomStep={SCREEN_BODY_PADDING_STEP}
    >
      <Box
        sx={{
          ...(scroll ? {} : { flex: 1, minHeight: 0 }),
          // Large title sits flush under the TopBar; horizontal/bottom
          // padding lives on scroll content (flush-edge cancel), not as a
          // gap below the header.
          ...(largeTitle
            ? {
                px: SCREEN_BODY_PADDING_STEP,
                pb: SCREEN_BODY_PADDING_STEP,
              }
            : { p: SCREEN_BODY_PADDING_STEP }),
          gap: BODY_GAP_STEP,
        }}
      >
        {children}
      </Box>
    </ContentEdgePaddingProvider>
  );
}

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
        borderTopWidth: 1,
        px: SCREEN_BODY_PADDING_STEP,
        pt: BODY_GAP_STEP,
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
      sx={{
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

function lastBreadcrumbTitle(
  breadcrumbs: ScreenBaseProps['breadcrumbs']
): ReactNode {
  return breadcrumbs[breadcrumbs.length - 1]?.name;
}

function buildBodyContentProps(
  scroll: boolean,
  titleScroll: ScreenTitleScrollProps | undefined
): BodyContentProps {
  const sx = scroll ? {} : { flex: 1 as const, minHeight: 0 as const };
  if (titleScroll === undefined) {
    return { sx };
  }
  return { sx, titleScroll };
}

function renderBodyChildren(
  content: ScreenBaseProps['content'],
  scroll: boolean,
  largeTitle: boolean,
  titleScroll: ScreenTitleScrollProps | undefined
): ReactNode {
  const rendered = content(buildBodyContentProps(scroll, titleScroll));
  if (scroll && largeTitle) {
    return (
      <>
        <ScreenLargeTitle />
        {rendered}
      </>
    );
  }
  return rendered;
}

/** Compact (mobile / tablet) ScreenBase — today's full-bleed TopBar shell. */
export function ScreenBaseCompact({
  screenId,
  breadcrumbs,
  actions,
  content,
  scroll = false,
  largeTitle = false,
  keyboardAvoiding = false,
  leading,
  footer,
  primaryAction,
  primaryActionBottomInset = 0,
  onRefresh,
  refreshing,
  dataSet,
}: ScreenBaseProps) {
  const globalTrailing = useAppFrameGlobalTrailing();
  const inner = (
    <Box
      sx={{ flex: 1 }}
      testID={`screen-${screenId}`}
      {...componentDataSet('ScreenBase', { ...dataSet, screen: screenId })}
    >
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs}
        actions={actions ?? []}
        leading={leading}
        largeTitle={largeTitle}
        globalTrailing={globalTrailing}
      />
      {primaryAction !== undefined ? (
        <ScreenBasePrimaryActionMutation config={primaryAction}>
          {(primaryActionProps) =>
            renderScreenBody({
              scroll,
              largeTitle,
              keyboardAvoiding,
              content,
              footer,
              primaryActionProps,
              primaryActionBottomInset,
              onRefresh,
              refreshing,
            })
          }
        </ScreenBasePrimaryActionMutation>
      ) : (
        renderScreenBody({
          scroll,
          largeTitle,
          keyboardAvoiding,
          content,
          footer,
          primaryActionProps: undefined,
          primaryActionBottomInset,
          onRefresh,
          refreshing,
        })
      )}
    </Box>
  );

  if (!largeTitle) {
    return inner;
  }

  return (
    <ScreenTitleProvider title={lastBreadcrumbTitle(breadcrumbs)}>
      {inner}
    </ScreenTitleProvider>
  );
}

function renderScreenBody(args: {
  scroll: boolean;
  largeTitle: boolean;
  keyboardAvoiding: boolean;
  content: ScreenBaseProps['content'];
  footer: ScreenBaseProps['footer'];
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
  onRefresh: ScreenBaseProps['onRefresh'];
  refreshing: ScreenBaseProps['refreshing'];
}): ReactNode {
  if (args.largeTitle) {
    return (
      <LargeTitleScreenBody
        scroll={args.scroll}
        keyboardAvoiding={args.keyboardAvoiding}
        content={args.content}
        footer={args.footer}
        primaryActionProps={args.primaryActionProps}
        primaryActionBottomInset={args.primaryActionBottomInset}
        onRefresh={args.onRefresh}
        refreshing={args.refreshing}
      />
    );
  }
  return (
    <ScreenBody
      scroll={args.scroll}
      keyboardAvoiding={args.keyboardAvoiding}
      content={args.content}
      footer={args.footer}
      primaryActionProps={args.primaryActionProps}
      primaryActionBottomInset={args.primaryActionBottomInset}
      titleScroll={undefined}
      largeTitle={false}
      onRefresh={args.onRefresh}
      refreshing={args.refreshing}
    />
  );
}

function LargeTitleScreenBody({
  scroll,
  keyboardAvoiding,
  content,
  footer,
  primaryActionProps,
  primaryActionBottomInset,
  onRefresh,
  refreshing,
}: {
  scroll: boolean;
  keyboardAvoiding: boolean;
  content: ScreenBaseProps['content'];
  footer: ScreenBaseProps['footer'];
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
  onRefresh: ScreenBaseProps['onRefresh'];
  refreshing: ScreenBaseProps['refreshing'];
}): ReactNode {
  const titleScroll = useScreenTitleScroll();
  return (
    <ScreenBody
      scroll={scroll}
      keyboardAvoiding={keyboardAvoiding}
      content={content}
      footer={footer}
      primaryActionProps={primaryActionProps}
      primaryActionBottomInset={primaryActionBottomInset}
      titleScroll={titleScroll}
      largeTitle
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
}

function renderScrollableBody(args: {
  scroll: boolean;
  inner: ReactNode;
  paddingBottom: number;
  titleScroll: ScreenTitleScrollProps | undefined;
  refreshControl: ReactElement<RefreshControlProps> | undefined;
}): ReactNode {
  if (args.scroll) {
    return (
      <ScrollView
        frameSx={{ flex: 1 }}
        sx={{
          flexGrow: 1,
          paddingBottom: args.paddingBottom,
        }}
        refreshControl={args.refreshControl}
        {...(args.titleScroll ?? {})}
      >
        {args.inner}
      </ScrollView>
    );
  }
  return <Box sx={{ flex: 1, minHeight: 0 }}>{args.inner}</Box>;
}

function ScreenBody({
  scroll,
  keyboardAvoiding,
  content,
  footer,
  primaryActionProps,
  primaryActionBottomInset,
  titleScroll,
  largeTitle,
  onRefresh,
  refreshing,
}: {
  scroll: boolean;
  keyboardAvoiding: boolean;
  content: ScreenBaseProps['content'];
  footer: ScreenBaseProps['footer'];
  primaryActionProps: ScreenBasePrimaryActionRenderProps | undefined;
  primaryActionBottomInset: number;
  titleScroll: ScreenTitleScrollProps | undefined;
  largeTitle: boolean;
  onRefresh: ScreenBaseProps['onRefresh'];
  refreshing: ScreenBaseProps['refreshing'];
}): ReactNode {
  const bottomInset = useSafeAreaBottom();
  const hasFooter = footer !== undefined;
  const scrollPaddingBottom = useMemo(
    () => scrollContentPaddingBottom(bottomInset, hasFooter),
    [bottomInset, hasFooter]
  );
  const refreshControl = useResolvedRefreshControl({
    onRefresh: scroll ? onRefresh : undefined,
    refreshing,
  });
  const inner = (
    <BodyInner scroll={scroll} largeTitle={largeTitle}>
      {renderBodyChildren(content, scroll, largeTitle, titleScroll)}
    </BodyInner>
  );
  const body = renderScrollableBody({
    scroll,
    inner,
    paddingBottom: scrollPaddingBottom,
    titleScroll: scroll ? titleScroll : undefined,
    refreshControl,
  });

  const bodyWithFooter = (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
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
