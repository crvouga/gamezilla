/** @jsxImportSource solid-js */

import { type JSX, Show } from 'solid-js';
import {
  ContentEdgePaddingProvider,
  CONTENT_EDGE_PADDING_STEP as SCREEN_BODY_PADDING_STEP,
} from '../content-edge-padding/index';
import {
  bodyNeedsSafeBottom,
  buildBodyContentProps,
} from '../screen-base-logic';
import type { ScreenBasePrimaryActionRender } from '../screen-base-primary-action/index';
import {
  primaryActionVisible,
  ScreenBasePrimaryFab,
} from '../screen-base-primary-action/index';
import type { ScreenBaseProps } from '../screen-base-types';
import { ScreenLargeTitle } from '../screen-large-title/index';
import { ScrollView } from '../scroll-view/index';
import type { ScreenTitleScrollProps } from '../use-screen-title-scroll';

/** The FAB's inset from the body's bottom-end corner (px), above any bar. */
const FLOATING_ACTION_MARGIN = 16;

export type ScreenBaseCompactBodyProps = {
  scroll: boolean;
  largeTitle: boolean;
  content: ScreenBaseProps['content'];
  footer: JSX.Element | undefined;
  bottomBar: JSX.Element | undefined;
  primary: ScreenBasePrimaryActionRender | undefined;
  primaryActionBottomInset: number;
  titleScroll: ScreenTitleScrollProps | undefined;
};

function BodyInner(props: {
  scroll: boolean;
  largeTitle: boolean;
  children: JSX.Element;
}): JSX.Element {
  return (
    <ContentEdgePaddingProvider
      step={SCREEN_BODY_PADDING_STEP}
      bottomStep={SCREEN_BODY_PADDING_STEP}
    >
      {/* 16px page edge (`CONTENT_EDGE_PADDING_STEP`), 12px between
          sections; a large title brings its own top space. */}
      <div
        class="box gap-3 px-4 pb-4"
        data-component="ScreenBody"
        classList={{
          'flex-1 min-h-0': !props.scroll,
          'pt-4': !props.largeTitle,
        }}
      >
        {props.children}
      </div>
    </ContentEdgePaddingProvider>
  );
}

/** Bottom-pinned footer (no surface fill, no hairline). */
function PinnedFooter(props: {
  children: JSX.Element;
  safeBottom: boolean;
}): JSX.Element {
  return (
    <div
      class="box bg-transparent"
      classList={{ safeBottom: props.safeBottom }}
      data-component="ScreenFooter"
    >
      <div class="box px-4 py-3">{props.children}</div>
    </div>
  );
}

function FloatingActionHost(props: {
  extraBottomInset: number;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box absolute right-4 z-10"
      style={{
        bottom: `${FLOATING_ACTION_MARGIN + props.extraBottomInset}px`,
      }}
    >
      {props.children}
    </div>
  );
}

/** Zero-height spacer that pads scroll content by the bottom safe-area inset. */
function SafeBottomSpacer(): JSX.Element {
  return (
    <div class="box" classList={{ safeBottom: true }} aria-hidden="true" />
  );
}

function ScrollableBody(props: ScreenBaseCompactBodyProps): JSX.Element {
  const needsSafeBottom = (): boolean =>
    bodyNeedsSafeBottom({
      hasFooter: props.footer !== undefined,
      hasBottomBar: props.bottomBar !== undefined,
    });
  const inner = (
    <BodyInner scroll={props.scroll} largeTitle={props.largeTitle}>
      <Show when={props.scroll && props.largeTitle}>
        <ScreenLargeTitle />
      </Show>
      {props.content(
        buildBodyContentProps(
          props.scroll,
          props.scroll ? undefined : props.titleScroll
        )
      )}
    </BodyInner>
  );
  return (
    <Show
      when={props.scroll}
      fallback={
        <div
          class="box flex-1 min-h-0"
          classList={{ safeBottom: needsSafeBottom() }}
        >
          {inner}
        </div>
      }
    >
      <ScrollView
        grow
        fill
        paddingBottom="xl"
        onScroll={props.titleScroll?.onScroll}
        dataSet={{ component: 'ScreenBodyScroll' }}
      >
        {inner}
        <Show when={needsSafeBottom()}>
          <SafeBottomSpacer />
        </Show>
      </ScrollView>
    </Show>
  );
}

/**
 * Compact `ScreenBase` body: padded column (or whole-body scroller), pinned
 * footer / bottom bar, and the floating primary action. Safe-area insets come
 * from the `.safeBottom` CSS class (never inline `env()`).
 */
export function ScreenBaseCompactBody(
  props: ScreenBaseCompactBodyProps
): JSX.Element {
  return (
    <div class="box flex-1 min-h-0 relative">
      <ScrollableBody {...props} />
      <Show when={props.footer}>
        {(footer) => (
          <PinnedFooter safeBottom={props.bottomBar === undefined}>
            {footer()}
          </PinnedFooter>
        )}
      </Show>
      <Show when={props.bottomBar}>
        {(bottomBar) => (
          <div
            class="box bg-transparent"
            classList={{ safeBottom: true }}
            data-component="ScreenBottomBar"
          >
            {bottomBar()}
          </div>
        )}
      </Show>
      <Show when={primaryActionVisible(props.primary) ? props.primary : null}>
        {(primary) => (
          <FloatingActionHost extraBottomInset={props.primaryActionBottomInset}>
            <ScreenBasePrimaryFab render={primary()} />
          </FloatingActionHost>
        )}
      </Show>
    </div>
  );
}
