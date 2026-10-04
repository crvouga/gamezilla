/** @jsxImportSource solid-js */
/**
 * Wide `ScreenBase`: page header row (breadcrumb trail + `ActionBar` +
 * primary `Button`) and either one `Island` card body or a canvas for
 * screen-composed islands. Lives inside `AppFrame`, which owns the global
 * header island.
 */

import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { ISLAND_GAP_STEP } from '@pkgs/ui-shared/layout';
import { createMemo, type JSX, Show } from 'solid-js';
import { ActionBar } from './action-bar';
import { useActionBarChrome } from './action-bar-chrome';
import { ContentEdgePaddingProvider } from './content-edge-padding';
import { Island } from './island';
import {
  buildBodyContentProps,
  hasScreenBaseActions,
  lastBreadcrumbTitle,
  partitionScreenBaseActions,
  SCREEN_SCROLL_BOTTOM_PADDING,
} from './screen-base-logic';
import type { ScreenBasePrimaryActionRender } from './screen-base-primary-action';
import {
  primaryActionVisible,
  ScreenBasePrimaryButton,
  WithScreenBasePrimaryAction,
} from './screen-base-primary-action';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenBreadcrumbTrail } from './screen-breadcrumb-trail';
import { useScreenFocus } from './screen-focus';
import { ScreenTitleProvider } from './screen-title-context';
import { ScrollView } from './scroll-view';

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
    <header
      class="box flex-row items-center gap-3 shrink-0"
      data-component="ScreenBaseHeader"
    >
      {props.leading}
      <ScreenBreadcrumbTrail breadcrumbs={props.breadcrumbs} />
      <div class="box flex-1" aria-hidden="true" />
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
    </header>
  );
}

function WidePinnedFooter(props: { children: JSX.Element }): JSX.Element {
  return (
    <div class="box pt-3 mt-3" data-component="ScreenFooter">
      {props.children}
    </div>
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
          <div class="box mt-3" data-component="ScreenBottomBar">
            {bottomBar()}
          </div>
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
        <Island class="flex-1 min-h-0">
          <div class="box flex-1 min-h-0">
            <WideBodyContent {...props} />
          </div>
        </Island>
      }
    >
      <Island class="flex-1 min-h-0 p-0">
        <ScrollView
          // The island has `p: 0`; the scroller owns the padding itself, so it
          // must not also cancel the island's edge step.
          flushEdge={false}
          class="flex-1"
          contentStyle={{
            'flex-grow': 1,
            padding: 'var(--ui-space-page)',
            'padding-bottom': `${SCREEN_SCROLL_BOTTOM_PADDING}px`,
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
        <div
          class="box flex-1 min-h-0"
          style={{ gap: `${ISLAND_GAP_STEP * 4}px` }}
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
        dataSet={{ component: 'ScreenBodyScroll' }}
      >
        <div class="box" style={{ gap: `${ISLAND_GAP_STEP * 4}px` }}>
          {inner}
        </div>
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
  let root: HTMLDivElement | undefined;
  useScreenFocus(
    () => root,
    () => props.screenId
  );
  return (
    <div
      ref={root}
      class="box flex-1 min-h-0"
      {...dataAttrs({
        component: 'ScreenBase',
        mode: 'wide',
        ...props.dataSet,
        screen: props.screenId,
      })}
      style={{ gap: `${ISLAND_GAP_STEP * 4}px` }}
    >
      <WidePageHeader {...props} />
      {body()}
    </div>
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
