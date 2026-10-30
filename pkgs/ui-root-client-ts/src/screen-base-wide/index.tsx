/** @jsxImportSource solid-js */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { ActionBar } from '../action-bar/index';
import { useActionBarChrome } from '../action-bar-chrome';
import { ContentEdgePaddingProvider } from '../content-edge-padding/index';
import {
  buildBodyContentProps,
  hasScreenBaseActions,
  lastBreadcrumbTitle,
  partitionScreenBaseActions,
} from '../screen-base-logic';
import type { ScreenBasePrimaryActionRender } from '../screen-base-primary-action/index';
import {
  primaryActionVisible,
  ScreenBasePrimaryButton,
  WithScreenBasePrimaryAction,
} from '../screen-base-primary-action/index';
import type { ScreenBaseProps } from '../screen-base-types';
import { ScreenBreadcrumbTrail } from '../screen-breadcrumb-trail/index';
import { useScreenFocus } from '../screen-focus/index';
import { SCREEN_MAX_WIDTH } from '../screen-measure';
import { ScreenTitleProvider } from '../screen-title-context/index';
import { ScrollView } from '../scroll-view/index';

type BodyProps = Pick<
  ScreenBaseProps,
  'content' | 'footer' | 'bottomBar' | 'measure'
> & {
  scroll: boolean;
};

/** The measure is a CSS width, not a token class: a dynamic value. */
function measureWidth(measure: ScreenBaseProps['measure']): string | undefined {
  return measure === undefined ? undefined : SCREEN_MAX_WIDTH[measure];
}

function WidePageHeader(
  props: ScreenBaseProps & {
    primary: ScreenBasePrimaryActionRender | undefined;
  }
): JSX.Element {
  const chrome = useActionBarChrome();
  const partition = createMemo(() =>
    partitionScreenBaseActions(props.actions ?? [])
  );
  const measure = (): string | undefined => measureWidth(props.measure);
  return (
    <header
      class="box flex-row items-center gap-3 shrink-0 min-h-13 py-2"
      classList={{ 'w-full mx-auto': measure() !== undefined }}
      style={{ 'max-width': measure() }}
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
          class="box flex-1 min-h-0 gap-2"
          classList={{ 'w-full mx-auto': props.measure !== undefined }}
          style={{ 'max-width': measureWidth(props.measure) }}
        >
          {inner}
        </div>
      }
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
    <WideCanvasBody
      scroll={props.scroll === true}
      content={props.content}
      footer={props.footer}
      bottomBar={props.bottomBar}
      measure={props.measure}
    />
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

/**
 * Wide `ScreenBase`: page header row (breadcrumb trail + `ActionBar` +
 * primary `Button`, at least 52px) and a flat canvas body whose left edge is
 * the page header's, so content lines up under the title. A screen with a
 * `measure` holds its header to that centered column too: a scrolling body
 * centers its `ScreenColumn` inside a scroller that still spans the frame
 * (the scrollbar stays at the edge); a fixed body is itself held to the
 * column. Lives inside `AppFrame`, which owns the global
 * header island.
 */
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
