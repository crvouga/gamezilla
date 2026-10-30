/** @jsxImportSource solid-js */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { useAppFrameGlobalTrailing } from '../app-frame-chrome/index';
import { ScreenBaseCompactBody } from '../screen-base-compact-body/index';
import { ScreenBaseHeader } from '../screen-base-header/index';
import { lastBreadcrumbTitle } from '../screen-base-logic';
import type { ScreenBasePrimaryActionRender } from '../screen-base-primary-action/index';
import { WithScreenBasePrimaryAction } from '../screen-base-primary-action/index';
import { useBodyScrolled } from '../screen-base-scroll-edge';
import type { ScreenBaseProps } from '../screen-base-types';
import { useScreenFocus } from '../screen-focus/index';
import { ScreenTitleProvider } from '../screen-title-context/index';
import type { ScreenTitleScrollProps } from '../use-screen-title-scroll';
import { useScreenTitleScroll } from '../use-screen-title-scroll';

type ShellProps = ScreenBaseProps & {
  primary: ScreenBasePrimaryActionRender | undefined;
  titleScroll: ScreenTitleScrollProps | undefined;
};

function CompactShell(props: ShellProps): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  let root: HTMLDivElement | undefined;
  useScreenFocus(
    () => root,
    () => props.screenId
  );
  const scrolled = useBodyScrolled(() => root);
  return (
    <div
      ref={root}
      class="box flex-1 min-h-0"
      {...dataAttrs({
        component: 'ScreenBase',
        mode: 'compact',
        ...props.dataSet,
        screen: props.screenId,
      })}
    >
      <ScreenBaseHeader
        breadcrumbs={props.breadcrumbs}
        actions={props.actions ?? []}
        leading={props.leading}
        largeTitle={props.largeTitle}
        scrolled={scrolled()}
        globalTrailing={globalTrailing()}
        renderActionsMenu={props.renderActionsMenu}
      />
      <ScreenBaseCompactBody
        scroll={props.scroll === true}
        largeTitle={props.largeTitle === true}
        content={props.content}
        footer={props.footer}
        bottomBar={props.bottomBar}
        primary={props.primary}
        primaryActionBottomInset={props.primaryActionBottomInset ?? 0}
        titleScroll={props.titleScroll}
      />
    </div>
  );
}

/** Reads the title-scroll handler; only mounted under `ScreenTitleProvider`. */
function LargeTitleShell(props: Omit<ShellProps, 'titleScroll'>): JSX.Element {
  const titleScroll = useScreenTitleScroll();
  return <CompactShell {...props} titleScroll={titleScroll} />;
}

/**
 * Compact (mobile / tablet) `ScreenBase`: full-bleed `TopBar` shell over a
 * constrained body.
 *
 * Body scrollbars must sit flush with the screen edge:
 * - Whole-body scroll → pass `scroll` (padding lives inside the scroller).
 * - Sticky chrome + nested list → use `ScreenBodyScrollView` /
 *   `ScreenBodyVirtualList`; the body provides `ContentEdgePaddingProvider`
 *   so nested scrollers bleed under horizontal padding automatically.
 *
 * Pass `largeTitle` for a body heading that reveals in the TopBar after scroll.
 * The TopBar's hairline appears once any scroller in the body leaves its top
 * (`useBodyScrolled`).
 */
export function ScreenBaseCompact(props: ScreenBaseProps): JSX.Element {
  return (
    <WithScreenBasePrimaryAction config={props.primaryAction}>
      {(primary) => (
        <Show
          when={props.largeTitle === true}
          fallback={
            <CompactShell
              {...props}
              primary={primary}
              titleScroll={undefined}
            />
          }
        >
          <ScreenTitleProvider title={lastBreadcrumbTitle(props.breadcrumbs)}>
            <LargeTitleShell {...props} primary={primary} />
          </ScreenTitleProvider>
        </Show>
      )}
    </WithScreenBasePrimaryAction>
  );
}
