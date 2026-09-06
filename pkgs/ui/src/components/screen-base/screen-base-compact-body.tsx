/** @jsxImportSource solid-js */
/**
 * Compact `ScreenBase` body: padded column (or whole-body scroller), pinned
 * footer / bottom bar, and the floating primary action. Safe-area insets come
 * from the `.safeBottom` CSS class (never inline `env()`).
 */

import { type JSX, Show } from 'solid-js';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import styles from '../hosts.module.css';
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
      <Box
        dataSet={{ component: 'ScreenBody' }}
        sx={[
          props.scroll ? false : { flex: 1, minHeight: 0 },
          // Large title sits flush under the TopBar; horizontal/bottom
          // padding lives on scroll content (flush-edge cancel).
          props.largeTitle
            ? { px: SCREEN_BODY_PADDING_STEP, pb: SCREEN_BODY_PADDING_STEP }
            : { p: SCREEN_BODY_PADDING_STEP },
          { gap: BODY_GAP_STEP },
        ]}
      >
        {props.children}
      </Box>
    </ContentEdgePaddingProvider>
  );
}

/** Bottom-pinned footer: full-bleed surface with a top divider. */
function PinnedFooter(props: {
  children: JSX.Element;
  safeBottom: boolean;
}): JSX.Element {
  return (
    <Box
      class={props.safeBottom ? styles['safeBottom'] : undefined}
      dataSet={{ component: 'ScreenFooter' }}
      sx={{
        background: 'surface',
        borderColor: 'border',
        borderTopWidth: 1,
        borderStyle: 'solid',
      }}
    >
      <Box
        sx={{
          px: SCREEN_BODY_PADDING_STEP,
          pt: BODY_GAP_STEP,
          pb: BODY_GAP_STEP,
        }}
      >
        {props.children}
      </Box>
    </Box>
  );
}

function FloatingActionHost(props: {
  extraBottomInset: number;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: FLOATING_ACTION_MARGIN,
        bottom: FLOATING_ACTION_MARGIN + props.extraBottomInset,
        zIndex: FLOATING_ACTION_Z_INDEX,
      }}
    >
      {props.children}
    </Box>
  );
}

/** Zero-height spacer that pads scroll content by the bottom safe-area inset. */
function SafeBottomSpacer(): JSX.Element {
  return <Box aria-hidden="true" class={styles['safeBottom']} />;
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
        <Box
          sx={{ flex: 1, minHeight: 0 }}
          class={needsSafeBottom() ? styles['safeBottom'] : undefined}
        >
          {inner}
        </Box>
      }
    >
      <ScrollView
        frameSx={{ flex: 1 }}
        sx={{ flexGrow: 1, paddingBottom: SCREEN_SCROLL_BOTTOM_PADDING }}
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
    <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
          <Box
            class={styles['safeBottom']}
            sx={{ background: 'surface' }}
            dataSet={{ component: 'ScreenBottomBar' }}
          >
            {bottomBar()}
          </Box>
        )}
      </Show>
      <Show when={primaryActionVisible(props.primary) ? props.primary : null}>
        {(primary) => (
          <FloatingActionHost extraBottomInset={props.primaryActionBottomInset}>
            <ScreenBasePrimaryFab render={primary()} />
          </FloatingActionHost>
        )}
      </Show>
    </Box>
  );
}
