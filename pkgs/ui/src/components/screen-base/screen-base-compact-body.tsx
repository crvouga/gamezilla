/** @jsxImportSource solid-js */
/**
 * Compact `ScreenBase` body: padded column (or whole-body scroller), pinned
 * footer / bottom bar, and the floating primary action. Safe-area insets come
 * from the `.safeBottom` CSS class (never inline `env()`).
 */

import { type JSX, Show } from 'solid-js';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { ScreenLargeTitle, type ScreenTitleScrollProps } from '../screen-title';
import { ScrollView } from '../scroll-view';
import {
  bodyNeedsSafeBottom,
  buildBodyContentProps,
  SCREEN_SCROLL_BOTTOM_PADDING,
} from './screen-base-logic';
import {
  primaryActionVisible,
  type ScreenBasePrimaryActionRender,
  ScreenBasePrimaryFab,
} from './screen-base-primary-action';
import type { ScreenBaseProps } from './screen-base-types';
import { SCREEN_BODY_PADDING_STEP } from './screen-body-padding';

/** Spacing-scale steps (1 = 4px): body gap 12px. */
const BODY_GAP_STEP = 3;
const FLOATING_ACTION_MARGIN = 16;
const FLOATING_ACTION_Z_INDEX = 10;
const BODY_PAD_PX = SCREEN_BODY_PADDING_STEP * 4;

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
      <div
        class="box"
        data-component="ScreenBody"
        classList={{ 'flex-1 min-h-0': !props.scroll }}
        style={{
          gap: `${BODY_GAP_STEP * 4}px`,
          ...(props.largeTitle
            ? {
                'padding-left': `${BODY_PAD_PX}px`,
                'padding-right': `${BODY_PAD_PX}px`,
                'padding-bottom': `${BODY_PAD_PX}px`,
              }
            : { padding: `${BODY_PAD_PX}px` }),
        }}
      >
        {props.children}
      </div>
    </ContentEdgePaddingProvider>
  );
}

/** Bottom-pinned footer: hairline divider only (no surface fill). */
function PinnedFooter(props: {
  children: JSX.Element;
  safeBottom: boolean;
}): JSX.Element {
  return (
    <div
      class="box bg-transparent border-border border-t border-solid"
      classList={{ safeBottom: props.safeBottom }}
      data-component="ScreenFooter"
    >
      <div
        class="box"
        style={{
          'padding-left': `${BODY_PAD_PX}px`,
          'padding-right': `${BODY_PAD_PX}px`,
          'padding-top': `${BODY_GAP_STEP * 4}px`,
          'padding-bottom': `${BODY_GAP_STEP * 4}px`,
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

function FloatingActionHost(props: {
  extraBottomInset: number;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box absolute"
      style={{
        right: `${FLOATING_ACTION_MARGIN}px`,
        bottom: `${FLOATING_ACTION_MARGIN + props.extraBottomInset}px`,
        'z-index': FLOATING_ACTION_Z_INDEX,
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
        class="flex-1"
        contentStyle={{
          'flex-grow': 1,
          'padding-bottom': `${SCREEN_SCROLL_BOTTOM_PADDING}px`,
        }}
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
            class="box bg-transparent border-t border-solid border-border"
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
