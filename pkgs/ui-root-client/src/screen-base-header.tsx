/** @jsxImportSource solid-js */
/**
 * App screen header: composes the `TopBar` primitive. Every screen gets the
 * same 52px row and hairline because `TopBar`'s row height is locked.
 *
 * Slot mapping:
 *   - `leading`  -> caller-supplied leading content + auto back button.
 *   - `center`   -> page title (from breadcrumbs), left-aligned after the
 *                   back control so it lines up with the left-aligned body.
 *                   A root screen (no back control) sets it as a heading.
 *   - `trailing` -> responsive action bar (header actions) + global chrome.
 */

import { createMemo, type JSX, Show } from 'solid-js';
import { ActionBar } from './action-bar';
import { useActionBarChrome } from './action-bar-chrome';
import { BackIconButton } from './back-icon-button';
import {
  deriveHeaderLayout,
  hasScreenBaseActions,
  partitionScreenBaseActions,
} from './screen-base-logic';
import type { ScreenBaseHeaderProps } from './screen-base-types';
import { useScreenTitleContext } from './screen-title-context';
import { TopBar } from './top-bar';
import { TopBarTitle } from './top-bar-title';
import { useBreadcrumbClick } from './use-breadcrumb-click';

/** Back control hit area: never below 40px, whatever the action chrome. */
const MIN_BACK_BUTTON_SIZE = 40;

function HeaderTrailing(props: ScreenBaseHeaderProps): JSX.Element {
  const chrome = useActionBarChrome();
  const partition = createMemo(() =>
    partitionScreenBaseActions(props.actions ?? [])
  );
  return (
    <div class="box flex-row items-center gap-1">
      <Show when={hasScreenBaseActions(partition())}>
        <ActionBar
          items={partition().iconItems}
          textActions={partition().textActions}
          buttonSize={chrome().buttonSize}
          gap={chrome().gap}
          slotWidth={chrome().slotWidth}
          showInlineLabels={chrome().showInlineLabels}
          renderMenu={props.renderActionsMenu}
          overflowDataSet={{ testid: 'header-overflow-menu' }}
        />
      </Show>
      {props.globalTrailing}
    </div>
  );
}

function HeaderLeading(props: {
  leading: JSX.Element | undefined;
  showBack: boolean;
  onBack: () => void;
}): JSX.Element {
  const chrome = useActionBarChrome();
  return (
    <>
      {props.leading}
      <Show when={props.showBack}>
        {/* Pulled into the edge so the chevron, not its hit area, lines up
            with the 16px page edge. */}
        <div class="box" classList={{ '-ml-2': props.leading === undefined }}>
          <BackIconButton
            size={Math.max(chrome().buttonSize, MIN_BACK_BUTTON_SIZE)}
            onClick={() => props.onBack()}
            dataSet={{ testid: 'nav-back' }}
          />
        </div>
      </Show>
    </>
  );
}

export function ScreenBaseHeader(props: ScreenBaseHeaderProps): JSX.Element {
  const titleCtx = useScreenTitleContext();
  const resolveClick = useBreadcrumbClick(() => props.breadcrumbs);
  const layout = createMemo(() => deriveHeaderLayout(props.breadcrumbs));
  const showTitle = (): boolean =>
    props.largeTitle === true ? (titleCtx?.showInTopBar() ?? false) : true;
  const hasTitle = (): boolean =>
    showTitle() && layout().title !== undefined && layout().title !== null;
  const hasTrailing = (): boolean =>
    (props.actions?.length ?? 0) > 0 ||
    (props.globalTrailing !== undefined && props.globalTrailing !== null);
  const onBack = (): void => {
    const crumb = layout().backCrumb;
    if (crumb !== undefined) resolveClick(crumb)?.();
  };
  return (
    <TopBar
      centerAlign="start"
      trailingSize={(props.actions?.length ?? 0) > 0 ? 'fill' : 'fit'}
      dataSet={{ component: 'ScreenBaseHeader' }}
      leading={
        props.leading !== undefined || layout().showBack ? (
          <HeaderLeading
            leading={props.leading}
            showBack={layout().showBack}
            onBack={onBack}
          />
        ) : undefined
      }
      center={
        <Show when={hasTitle()}>
          <TopBarTitle
            label={layout().title}
            root={!layout().showBack && props.leading === undefined}
          />
        </Show>
      }
      trailing={
        <Show when={hasTrailing()}>
          <HeaderTrailing {...props} />
        </Show>
      }
    />
  );
}
