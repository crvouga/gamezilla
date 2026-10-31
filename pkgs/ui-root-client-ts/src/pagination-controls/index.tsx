/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { PaginationWindowItem } from '@pkgs/ui-root-shared-ts/build-pagination-window';
import { buildPaginationWindow } from '@pkgs/ui-root-shared-ts/build-pagination-window';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconComponent } from '../create-icon/index';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '../icons';

const DEFAULT_SIZE = 28;
const DEFAULT_SIBLING_COUNT = 1;
const ICON_SIZE = 14;
/** Minimum touch target around each visual circle. */
const HIT_TARGET = 44;

export type PaginationControlsProps = {
  /** 0-based current page. */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPageChange: (pageIndex: number) => void;
  /** Pages shown on each side of the current page. Defaults to 1. */
  readonly siblingCount?: number | undefined;
  /** Visual circle diameter in px (hit target stays 44). Defaults to 28. */
  readonly size?: number | undefined;
  readonly disabled?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  readonly dataSet?: ComponentDataSet | undefined;
};

const HIT_STYLE: JSX.CSSProperties = {
  'min-width': `${HIT_TARGET}px`,
  'min-height': `${HIT_TARGET}px`,
  'align-items': 'center',
  'justify-content': 'center',
  'border-radius': '9999px',
};

function circleStyle(size: number, active: boolean): JSX.CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    'border-radius': '9999px',
    'align-items': 'center',
    'justify-content': 'center',
    'background-color': active ? colorVar('tintSubtle') : colorVar('surface'),
  };
}

function NavButton(props: {
  readonly label: string;
  readonly size: number;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly icon: IconComponent;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint"
      type="button"
      style={{ ...HIT_STYLE, opacity: props.disabled ? 0.4 : 1 }}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      <div class="box" style={circleStyle(props.size, false)}>
        <Dynamic component={props.icon} size={ICON_SIZE} color="icon" />
      </div>
    </button>
  );
}

function PageSlot(props: {
  readonly item: PaginationWindowItem;
  readonly pageIndex: number;
  readonly size: number;
  readonly disabled: boolean;
  readonly onGo: (pageIndex: number) => void;
}): JSX.Element {
  const { t } = useLingui();
  const pageLabel = (pageIndex: number): string => {
    const label = String(pageIndex + 1);
    return t`Page ${label}`;
  };
  return (
    <Show
      when={props.item.type === 'page' ? props.item : undefined}
      fallback={
        <div
          class="box"
          style={{
            ...HIT_STYLE,
            width: `${props.size}px`,
            height: `${props.size}px`,
          }}
          aria-hidden="true"
        >
          <p class="text textFootnote">…</p>
        </div>
      }
    >
      {(page) => {
        const active = () => page().pageIndex === props.pageIndex;
        const label = () => String(page().pageIndex + 1);
        return (
          <button
            class="clickable clickableTint"
            type="button"
            style={HIT_STYLE}
            aria-label={pageLabel(page().pageIndex)}
            aria-current={active() ? 'page' : undefined}
            disabled={props.disabled}
            onClick={() => props.onGo(page().pageIndex)}
          >
            <div class="box" style={circleStyle(props.size, active())}>
              <p
                class="text textFootnote"
                style={{
                  color: active()
                    ? colorVar('tint')
                    : colorVar('textSecondary'),
                  'font-weight': active() ? '600' : '400',
                }}
              >
                {label()}
              </p>
            </div>
          </button>
        );
      }}
    </Show>
  );
}

/**
 * `PaginationControls` -- circular Start / Prev / page window / Next / End.
 *
 * Page index is 0-based. The middle strip is built by
 * {@link buildPaginationWindow}. Every control is a `Clickable` with a
 * 44px hit target wrapping a `size`-px visual circle; the active page carries
 * `aria-current="page"`. Rendered as `<nav aria-label="Pagination">`.
 */
export function PaginationControls(
  props: PaginationControlsProps
): JSX.Element {
  const { t } = useLingui();
  const size = () => props.size ?? DEFAULT_SIZE;
  const lastIndex = () => Math.max(0, props.pageCount - 1);
  const atStart = () => props.pageIndex <= 0;
  const atEnd = () => props.pageIndex >= lastIndex();
  const disabled = () => props.disabled === true;
  const navDisabled = () => disabled() || props.pageCount <= 0;
  const items = () =>
    buildPaginationWindow(
      props.pageIndex,
      props.pageCount,
      props.siblingCount ?? DEFAULT_SIBLING_COUNT
    );
  const go = (next: number): void => {
    if (disabled() || props.pageCount <= 0) return;
    const clamped = Math.min(Math.max(0, next), lastIndex());
    if (clamped !== props.pageIndex) props.onPageChange(clamped);
  };

  return (
    <nav
      class="box flex-row items-center"
      {...dataAttrs({ component: 'PaginationControls', ...props.dataSet })}
      aria-label={t`Pagination`}
    >
      <NavButton
        label={t`Start`}
        size={size()}
        disabled={navDisabled() || atStart()}
        onClick={() => go(0)}
        icon={ChevronsLeftIcon}
      />
      <NavButton
        label={t`Previous`}
        size={size()}
        disabled={navDisabled() || atStart()}
        onClick={() => go(props.pageIndex - 1)}
        icon={ChevronLeftIcon}
      />
      <For each={items()}>
        {(item) => (
          <PageSlot
            item={item}
            pageIndex={props.pageIndex}
            size={size()}
            disabled={disabled()}
            onGo={go}
          />
        )}
      </For>
      <NavButton
        label={t`Next`}
        size={size()}
        disabled={navDisabled() || atEnd()}
        onClick={() => go(props.pageIndex + 1)}
        icon={ChevronRightIcon}
      />
      <NavButton
        label={t`End`}
        size={size()}
        disabled={navDisabled() || atEnd()}
        onClick={() => go(lastIndex())}
        icon={ChevronsRightIcon}
      />
    </nav>
  );
}
