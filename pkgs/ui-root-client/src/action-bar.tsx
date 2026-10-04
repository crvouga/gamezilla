/** @jsxImportSource solid-js */
/**
 * `ActionBar` -- responsive row of icon actions with an overflow menu.
 *
 * Measures its own width (`ResizeObserver`) and partitions `items` into
 * inline icon buttons plus a "More" trigger using the framework-free
 * {@link partitionActionBarItems}. The dropdown defaults to a `FloatingMenu`
 * anchored to the More trigger; pass `renderMenu` to supply another panel.
 *
 * @example
 * ```tsx
 * <ActionBar
 *   items={[
 *     { id: 'share', label: 'Share', icon: ShareIcon, onClick: share },
 *     { id: 'settings', label: 'Settings', icon: SettingsIcon, onClick: open },
 *   ]}
 * />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import type {
  ActionBarAlign,
  ActionBarItem,
  ActionBarOverflowMode,
  ActionBarTextAction,
} from './action-bar-logic';
import type { ActionBarOverflowTriggerSpec } from './action-bar-parts';
import {
  ActionBarIconItems,
  ActionBarOverflowTrigger,
  ActionBarTextItems,
} from './action-bar-parts';
import type {
  OverflowMenuHeader,
  OverflowMenuRenderProps,
} from './overflow-menu-button';
import {
  buildOverflowMenuContent,
  OVERFLOW_MENU_DEFAULT_WIDTH,
  renderDefaultOverflowMenu,
} from './overflow-menu-button';
import type { ActionBarController } from './use-action-bar-controller';
import { useActionBarController } from './use-action-bar-controller';

export type ActionBarProps = {
  items: readonly ActionBarItem[];
  /** Icon-less actions that render as compact text buttons when inline. */
  textActions?: readonly ActionBarTextAction[] | undefined;
  /** Always-visible trailing slot after overflow-managed items. */
  endSlot?: JSX.Element | undefined;
  /** Main-axis packing. Defaults to `'end'` (trailing chrome). */
  align?: ActionBarAlign | undefined;
  /**
   * Overflow behavior. `'auto'` (default) collapses into a menu when space is
   * tight. `'never'` always renders every item as an inline icon button.
   */
  overflow?: ActionBarOverflowMode | undefined;
  /** Custom overflow trigger (e.g. avatar). Defaults to menu icon. */
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  /** Optional header for the overflow dropdown panel. */
  overflowMenuHeader?: OverflowMenuHeader | undefined;
  buttonSize?: number | undefined;
  gap?: number | undefined;
  /** Horizontal budget per inline slot; defaults to `max(buttonSize, 44)`. */
  slotWidth?: number | undefined;
  /** When true, shows a caption under each inline action. */
  showInlineLabels?: boolean | undefined;
  /** Overrides the default `FloatingMenu` overflow dropdown. */
  renderMenu?: ((menu: OverflowMenuRenderProps) => JSX.Element) | undefined;
  /** Notified when the More trigger is clicked (after the menu opens). */
  onOpenMenu?: (() => void) | undefined;
  /** `data-*` identifiers for the More trigger. */
  overflowDataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ActionBarItemsRow(props: {
  bar: ActionBarController;
  showInlineLabels: boolean | undefined;
  overflowTrigger: ActionBarOverflowTriggerSpec;
  overflowDataSet: ComponentDataSet | undefined;
  onOpenMenu: (() => void) | undefined;
}): JSX.Element {
  const onOpen = (): void => {
    props.bar.menu.openMenu();
    props.onOpenMenu?.();
  };
  return (
    <div
      class="box flex-row items-center min-w-0"
      style={{ gap: `${(props.bar.resolved().gap / 4) * 4}px` }}
    >
      <ActionBarTextItems actions={props.bar.layout().inlineText} />
      <ActionBarIconItems
        items={props.bar.layout().partition.visible}
        buttonSize={props.bar.resolved().buttonSize}
        showInlineLabels={props.showInlineLabels}
        slotWidth={props.bar.resolved().slotWidth}
      />
      <Show when={props.bar.layout().overflowActions.length > 0}>
        <ActionBarOverflowTrigger
          buttonSize={props.bar.resolved().buttonSize}
          onOpen={onOpen}
          setTrigger={props.bar.menu.setTrigger}
          open={props.bar.menu.open()}
          overflowTrigger={props.overflowTrigger}
          showInlineLabels={props.showInlineLabels}
          slotWidth={props.bar.resolved().slotWidth}
          dataSet={props.overflowDataSet}
        />
      </Show>
    </div>
  );
}

function ActionBarMenu(props: {
  bar: ActionBarController;
  header: OverflowMenuHeader | undefined;
  renderMenu: ((menu: OverflowMenuRenderProps) => JSX.Element) | undefined;
}): JSX.Element {
  const renderMenu = () => props.renderMenu ?? renderDefaultOverflowMenu;
  // Getter-backed so the menu re-renders rows / open state without remounting.
  const menu: OverflowMenuRenderProps = {
    get open() {
      return props.bar.menu.open();
    },
    onClose: () => props.bar.menu.close(),
    get anchor() {
      return props.bar.menu.anchor();
    },
    width: OVERFLOW_MENU_DEFAULT_WIDTH,
    placement: 'bottom-end',
    get content() {
      return buildOverflowMenuContent(
        props.bar.layout().overflowActions,
        props.bar.menu.close,
        props.header
      );
    },
  };
  return <Show when={props.bar.measures()}>{renderMenu()(menu)}</Show>;
}

export function ActionBar(props: ActionBarProps): JSX.Element {
  const hasEndSlot = (): boolean =>
    props.endSlot !== undefined && props.endSlot !== null;
  const bar = useActionBarController({
    get items() {
      return props.items;
    },
    get textActions() {
      return props.textActions;
    },
    get hasEndSlot() {
      return hasEndSlot();
    },
    get align() {
      return props.align;
    },
    get overflow() {
      return props.overflow;
    },
    get buttonSize() {
      return props.buttonSize;
    },
    get gap() {
      return props.gap;
    },
    get slotWidth() {
      return props.slotWidth;
    },
  });

  return (
    <Show when={bar.hasContent()}>
      <div
        class="box flex-row items-center"
        {...dataAttrs({ component: 'ActionBar', ...props.dataSet })}
        style={{
          ...(bar.measures()
            ? {
                flex: 1,
                'min-width': 0,
                alignSelf: 'stretch',
                width: '100%',
              }
            : {}),
          'justify-content':
            bar.resolved().align === 'start' ? 'flex-start' : 'flex-end',
          gap: `${(bar.resolved().gap / 4) * 4}px`,
        }}
        ref={bar.setContainer}
      >
        <ActionBarItemsRow
          bar={bar}
          showInlineLabels={props.showInlineLabels}
          overflowTrigger={props.overflowTrigger}
          overflowDataSet={props.overflowDataSet}
          onOpenMenu={props.onOpenMenu}
        />
        <Show when={hasEndSlot()}>
          <div class="box" ref={bar.setEndSlot}>
            {props.endSlot}
          </div>
        </Show>
        <ActionBarMenu
          bar={bar}
          header={props.overflowMenuHeader}
          renderMenu={props.renderMenu}
        />
      </div>
    </Show>
  );
}
