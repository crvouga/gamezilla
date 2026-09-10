/** @jsxImportSource solid-js */
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
 */

import { type JSX, Show } from 'solid-js';
import { dataAttrs } from '../../component-id';
import { useAppFrameGlobalTrailing } from '../app-frame';
import {
  ScreenTitleProvider,
  type ScreenTitleScrollProps,
  useScreenTitleScroll,
} from '../screen-title';
import { ScreenBaseCompactBody } from './screen-base-compact-body';
import { ScreenBaseHeader } from './screen-base-header';
import { lastBreadcrumbTitle } from './screen-base-logic';
import {
  type ScreenBasePrimaryActionRender,
  WithScreenBasePrimaryAction,
} from './screen-base-primary-action';
import type { ScreenBaseProps } from './screen-base-types';

type ShellProps = ScreenBaseProps & {
  primary: ScreenBasePrimaryActionRender | undefined;
  titleScroll: ScreenTitleScrollProps | undefined;
};

function CompactShell(props: ShellProps): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <div
      class="box flex-1 min-h-[0]"
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
