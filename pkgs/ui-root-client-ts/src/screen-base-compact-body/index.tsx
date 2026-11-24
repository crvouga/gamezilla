/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import {
  ContentEdgePaddingProvider,
  CONTENT_EDGE_PADDING_STEP as SCREEN_BODY_PADDING_STEP,
} from '../content-edge-padding/index';
import {
  FLOATING_ACTION_MARGIN,
  FloatingActionClearance,
  FloatingActionClearanceProvider,
  floatingActionClearance,
} from '../floating-action-clearance/index';
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
import { createScreenSlot } from '../screen-slot';
import { ScrollView } from '../scroll-view/index';
import type { ScreenTitleScrollProps } from '../use-screen-title-scroll';

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
        class={[
          'box gap-3 px-4 pb-4',
          {
            'flex-1 min-h-0': !props.scroll,
            'pt-4': !props.largeTitle,
          },
        ]}
        data-component="ScreenBody"
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
      class={['box bg-transparent', { safeBottom: props.safeBottom }]}
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
  return <div class={['box', { safeBottom: true }]} aria-hidden="true" />;
}

function ScrollableBody(
  props: Pick<
    ScreenBaseCompactBodyProps,
    'scroll' | 'largeTitle' | 'content' | 'titleScroll'
  > & { hasFooter: boolean; hasBottomBar: boolean }
): JSX.Element {
  const needsSafeBottom = (): boolean =>
    bodyNeedsSafeBottom({
      hasFooter: props.hasFooter,
      hasBottomBar: props.hasBottomBar,
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
        <div class={['box flex-1 min-h-0', { safeBottom: needsSafeBottom() }]}>
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
        <FloatingActionClearance />
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
  // Each slot is resolved once: reading the prop again would build its
  // nodes a second time and pull them out of the place they render in.
  const footer = createScreenSlot(() => props.footer);
  const bottomBar = createScreenSlot(() => props.bottomBar);
  return (
    <div class="box flex-1 min-h-0 relative">
      {/* Scrollers in the body end with room the FAB covers, so the last
          row always scrolls clear of it. */}
      <FloatingActionClearanceProvider
        clearance={
          primaryActionVisible(props.primary)
            ? floatingActionClearance(props.primaryActionBottomInset)
            : 0
        }
      >
        <ScrollableBody
          scroll={props.scroll}
          largeTitle={props.largeTitle}
          content={props.content}
          titleScroll={props.titleScroll}
          hasFooter={footer.present()}
          hasBottomBar={bottomBar.present()}
        />
      </FloatingActionClearanceProvider>
      <Show when={footer.present()}>
        <PinnedFooter safeBottom={!bottomBar.present()}>
          {footer.content()}
        </PinnedFooter>
      </Show>
      <Show when={bottomBar.present()}>
        <div
          class={['box bg-transparent', { safeBottom: true }]}
          data-component="ScreenBottomBar"
        >
          {bottomBar.content()}
        </div>
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
