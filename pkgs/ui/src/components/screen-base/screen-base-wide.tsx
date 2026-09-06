/** @jsxImportSource solid-js */
/**
 * Wide `ScreenBase`: page header row (breadcrumb trail + `ActionBar` +
 * primary `Button`) and either one `Island` card body or a canvas for
 * screen-composed islands. Lives inside `AppFrame`, which owns the global
 * header island.
 */

import { createMemo, type JSX, Show } from 'solid-js';
import {
  ISLAND_GAP_STEP,
  ISLAND_PADDING_STEP,
  useActionBarChrome,
} from '../../theme';
import { ActionBar } from '../action-bar';
import { Box } from '../box';
import { ContentEdgePaddingProvider } from '../content-edge-padding';
import { Island } from '../island';
import { ScreenTitleProvider } from '../screen-title';
import { ScrollView } from '../scroll-view';
import { Spacer } from '../spacer';
import {
  buildBodyContentProps,
  hasScreenBaseActions,
  lastBreadcrumbTitle,
  partitionScreenBaseActions,
  SCREEN_SCROLL_BOTTOM_PADDING,
} from './screen-base-logic';
import {
  primaryActionVisible,
  type ScreenBasePrimaryActionRender,
  ScreenBasePrimaryButton,
  WithScreenBasePrimaryAction,
} from './screen-base-primary-action';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenBreadcrumbTrail } from './screen-breadcrumb-trail';

type BodyProps = Pick<ScreenBaseProps, 'content' | 'footer' | 'bottomBar'> & {
  scroll: boolean;
};

function WidePageHeader(
  props: ScreenBaseProps & {
    primary: ScreenBasePrimaryActionRender | undefined;
  }
): JSX.Element {
  const chrome = useActionBarChrome();
  const partition = createMemo(() =>
    partitionScreenBaseActions(props.actions ?? [])
  );
  return (
    <Box
      as="header"
      dataSet={{ component: 'ScreenBaseHeader' }}
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 }}
    >
      {props.leading}
      <ScreenBreadcrumbTrail breadcrumbs={props.breadcrumbs} />
      <Spacer />
      <Show when={hasScreenBaseActions(partition())}>
        <ActionBar
          items={partition().iconItems}
          textActions={partition().textActions}
          buttonSize={chrome().buttonSize}
          gap={chrome().gap}
          slotWidth={chrome().slotWidth}
          showInlineLabels
          renderMenu={props.renderActionsMenu}
          overflowDataSet={{ testid: 'header-overflow-menu' }}
        />
      </Show>
      <Show when={primaryActionVisible(props.primary) ? props.primary : null}>
        {(primary) => <ScreenBasePrimaryButton render={primary()} />}
      </Show>
    </Box>
  );
}

function WidePinnedFooter(props: { children: JSX.Element }): JSX.Element {
  return (
    <Box
      dataSet={{ component: 'ScreenFooter' }}
      sx={{
        borderColor: 'border',
        borderTopWidth: 1,
        borderStyle: 'solid',
        pt: 3,
        mt: 3,
      }}
    >
      {props.children}
    </Box>
  );
}

function WideBodyContent(props: BodyProps): JSX.Element {
  return (
    <>
      {props.content(buildBodyContentProps(props.scroll, undefined))}
      <Show when={props.footer}>
        {(footer) => <WidePinnedFooter>{footer()}</WidePinnedFooter>}
      </Show>
      <Show when={props.bottomBar}>
        {(bottomBar) => (
          <Box sx={{ mt: 3 }} dataSet={{ component: 'ScreenBottomBar' }}>
            {bottomBar()}
          </Box>
        )}
      </Show>
    </>
  );
}

function WideIslandBody(props: BodyProps): JSX.Element {
  return (
    <Show
      when={props.scroll}
      fallback={
        <Island sx={{ flex: 1, minHeight: 0 }}>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <WideBodyContent {...props} />
          </Box>
        </Island>
      }
    >
      <Island sx={{ flex: 1, minHeight: 0, p: 0 }}>
        <ScrollView
          // The island has `p: 0`; the scroller owns the padding itself, so it
          // must not also cancel the island's edge step.
          flushEdge={false}
          frameSx={{ flex: 1 }}
          sx={{
            flexGrow: 1,
            p: ISLAND_PADDING_STEP,
            paddingBottom: SCREEN_SCROLL_BOTTOM_PADDING,
          }}
          dataSet={{ component: 'ScreenBodyScroll' }}
        >
          <WideBodyContent {...props} />
        </ScrollView>
      </Island>
    </Show>
  );
}

function WideCanvasBody(props: BodyProps): JSX.Element {
  const inner = (
    <ContentEdgePaddingProvider step={0}>
      <WideBodyContent {...props} />
    </ContentEdgePaddingProvider>
  );
  return (
    <Show
      when={props.scroll}
      fallback={
        <Box sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}>{inner}</Box>
      }
    >
      <ScrollView
        frameSx={{ flex: 1 }}
        sx={{ flexGrow: 1, paddingBottom: SCREEN_SCROLL_BOTTOM_PADDING }}
        dataSet={{ component: 'ScreenBodyScroll' }}
      >
        <Box sx={{ gap: ISLAND_GAP_STEP }}>{inner}</Box>
      </ScrollView>
    </Show>
  );
}

function WideShell(
  props: ScreenBaseProps & {
    primary: ScreenBasePrimaryActionRender | undefined;
  }
): JSX.Element {
  const body = (): JSX.Element => (
    <Show
      when={(props.surface ?? 'island') === 'canvas'}
      fallback={
        <WideIslandBody
          scroll={props.scroll === true}
          content={props.content}
          footer={props.footer}
          bottomBar={props.bottomBar}
        />
      }
    >
      <WideCanvasBody
        scroll={props.scroll === true}
        content={props.content}
        footer={props.footer}
        bottomBar={props.bottomBar}
      />
    </Show>
  );
  return (
    <Box
      sx={{ flex: 1, minHeight: 0, gap: ISLAND_GAP_STEP }}
      dataSet={{
        component: 'ScreenBase',
        mode: 'wide',
        ...props.dataSet,
        screen: props.screenId,
      }}
    >
      <WidePageHeader {...props} />
      {body()}
    </Box>
  );
}

export function ScreenBaseWide(props: ScreenBaseProps): JSX.Element {
  return (
    <WithScreenBasePrimaryAction config={props.primaryAction}>
      {(primary) => (
        <Show
          when={props.largeTitle === true}
          fallback={<WideShell {...props} primary={primary} />}
        >
          <ScreenTitleProvider title={lastBreadcrumbTitle(props.breadcrumbs)}>
            <WideShell {...props} primary={primary} />
          </ScreenTitleProvider>
        </Show>
      )}
    </WithScreenBasePrimaryAction>
  );
}
