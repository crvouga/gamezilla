/** @jsxImportSource solid-js */
/**
 * Wide `ScreenBase`: page header row (breadcrumb trail + `ActionBar` +
 * primary `Button`, at least 52px) and either one `Island` card body or a
 * canvas for screen-composed islands, 8px apart on the wide backdrop. Lives
 * inside `AppFrame`, which owns the global header island.
 */

import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
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
      class="box flex-row items-center gap-3 shrink-0 min-h-13 py-2"
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
        <Island grow>
          <div class="box flex-1 min-h-0">
            <WideBodyContent {...props} />
          </div>
        </Island>
      }
    >
      <Island grow>
        <ScrollView
          // The scroller must not cancel the island's edge step. No side
          // padding: the body's left edge is the page header's, so content
          // lines up under the title.
          flushEdge={false}
          grow
          fill
          paddingTop="md"
          paddingBottom="xl"
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
      fallback={<div class="box flex-1 min-h-0 gap-2">{inner}</div>}
    >
      <ScrollView
        grow
        fill
        paddingBottom="xl"
        dataSet={{ component: 'ScreenBodyScroll' }}
      >
        <div class="box gap-2">{inner}</div>
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
      class="box flex-1 min-h-0 gap-2"
      {...dataAttrs({
        component: 'ScreenBase',
        mode: 'wide',
        ...props.dataSet,
        screen: props.screenId,
      })}
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
