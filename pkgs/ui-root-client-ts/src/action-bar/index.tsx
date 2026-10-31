/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { type JSX, Show } from 'solid-js';
import type {
  ActionBarAlign,
  ActionBarItem,
  ActionBarOverflowMode,
  ActionBarTextAction,
} from '../action-bar-logic';
import type { ActionBarOverflowTriggerSpec } from '../action-bar-parts/index';
import {
  ActionBarIconItems,
  ActionBarOverflowTrigger,
  ActionBarTextItems,
} from '../action-bar-parts/index';
import type {
  OverflowMenuHeader,
  OverflowMenuRenderProps,
} from '../overflow-menu-button/index';
import {
  buildOverflowMenuContent,
  OVERFLOW_MENU_DEFAULT_WIDTH,
  renderDefaultOverflowMenu,
} from '../overflow-menu-button/index';
import type { ActionBarController } from '../use-action-bar-controller';
import {
  ACTION_BAR_MORE_KEY,
  itemKey,
  textKey,
  useActionBarController,
} from '../use-action-bar-controller';

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
  /** Width of a labeled inline control (`showInlineLabels`); never below 44. */
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
      <ActionBarTextItems
        actions={props.bar.layout().inlineText}
        track={(id, el) => props.bar.widths.track(textKey(id), el)}
      />
      <ActionBarIconItems
        items={props.bar.layout().partition.visible}
        buttonSize={props.bar.resolved().buttonSize}
        showInlineLabels={props.showInlineLabels}
        slotWidth={props.bar.resolved().slotWidth}
        track={(id, el) => props.bar.widths.track(itemKey(id), el)}
      />
      <Show when={props.bar.layout().overflowActions.length > 0}>
        <ActionBarOverflowTrigger
          buttonSize={props.bar.resolved().buttonSize}
          onOpen={onOpen}
          setTrigger={(el) => {
            props.bar.menu.setTrigger(el);
            props.bar.widths.track(ACTION_BAR_MORE_KEY, el);
          }}
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
    get showInlineLabels() {
      return props.showInlineLabels;
    },
  });

  return (
    <Show when={bar.hasContent()}>
      <div
        class="box flex-row items-center"
        {...dataAttrs({ component: 'ActionBar', ...props.dataSet })}
        style={{
          // A measuring bar asks for its full row and gives room up before
          // its row-mates do (shrink 1000), down to the More trigger. Its
          // size never depends on what it renders, so collapsing is stable.
          ...(bar.measures()
            ? {
                width: cssPx(bar.naturalWidth()),
                'max-width': '100%',
                'min-width': cssPx(bar.minWidth()),
                'flex-grow': 0,
                'flex-shrink': 1000,
                'align-self': 'stretch',
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
