/**
 * `PaginationControls` -- circular Start / Prev / page window / Next / End.
 *
 * Page index is 0-based. The middle strip is built by
 * {@link buildPaginationWindow}; nav and page buttons are quiet IconButtons.
 */

import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { IconButton } from '../icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from '../icons';
import { Text } from '../text';
import {
  buildPaginationWindow,
  type PaginationWindowItem,
} from './build-pagination-window';

const DEFAULT_SIZE = 28;
const DEFAULT_SIBLING_COUNT = 1;
const ICON_SIZE = 14;

export type PaginationControlsProps = {
  /** 0-based current page. */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPageChange: (pageIndex: number) => void;
  /** Pages shown on each side of the current page. Defaults to 1. */
  readonly siblingCount?: number;
  /** IconButton diameter in px. Defaults to 28. */
  readonly size?: number;
  readonly disabled?: boolean;
  readonly dataSet?: ComponentDataSet;
};

export function PaginationControls(props: PaginationControlsProps): ReactNode {
  const {
    pageIndex,
    pageCount,
    onPageChange,
    siblingCount = DEFAULT_SIBLING_COUNT,
    size = DEFAULT_SIZE,
    disabled = false,
    dataSet,
  } = props;
  const theme = useTheme();
  const lastIndex = Math.max(0, pageCount - 1);
  const atStart = pageIndex <= 0;
  const atEnd = pageIndex >= lastIndex;
  const windowItems = buildPaginationWindow(pageIndex, pageCount, siblingCount);
  const go = (next: number) => {
    if (disabled || pageCount <= 0) return;
    const clamped = Math.min(Math.max(0, next), lastIndex);
    if (clamped !== pageIndex) onPageChange(clamped);
  };
  const iconColor = theme.colors.icon;
  const navDisabled = disabled || pageCount <= 0;

  return (
    <Box
      dataSet={{ component: 'PaginationControls', ...dataSet }}
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 0.5 }}
    >
      <NavIconButton
        label="Start"
        size={size}
        disabled={navDisabled || atStart}
        onPress={() => go(0)}
      >
        <ChevronsLeftIcon size={ICON_SIZE} color={iconColor} />
      </NavIconButton>
      <NavIconButton
        label="Previous"
        size={size}
        disabled={navDisabled || atStart}
        onPress={() => go(pageIndex - 1)}
      >
        <ChevronLeftIcon size={ICON_SIZE} color={iconColor} />
      </NavIconButton>
      <PaginationPageStrip
        items={windowItems}
        pageIndex={pageIndex}
        size={size}
        disabled={disabled}
        onGo={go}
      />
      <NavIconButton
        label="Next"
        size={size}
        disabled={navDisabled || atEnd}
        onPress={() => go(pageIndex + 1)}
      >
        <ChevronRightIcon size={ICON_SIZE} color={iconColor} />
      </NavIconButton>
      <NavIconButton
        label="End"
        size={size}
        disabled={navDisabled || atEnd}
        onPress={() => go(lastIndex)}
      >
        <ChevronsRightIcon size={ICON_SIZE} color={iconColor} />
      </NavIconButton>
    </Box>
  );
}

function NavIconButton(props: {
  readonly label: string;
  readonly size: number;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <IconButton
      label={props.label}
      size={props.size}
      background="surface"
      tooltip="hover"
      disabled={props.disabled}
      onPress={props.onPress}
    >
      {props.children}
    </IconButton>
  );
}

function PaginationPageStrip(props: {
  readonly items: readonly PaginationWindowItem[];
  readonly pageIndex: number;
  readonly size: number;
  readonly disabled: boolean;
  readonly onGo: (pageIndex: number) => void;
}): ReactNode {
  const { items, pageIndex, size, disabled, onGo } = props;
  return (
    <>
      {items.map((item) => (
        <PaginationWindowSlot
          key={
            item.type === 'ellipsis'
              ? `ellipsis-${item.id}`
              : `page-${item.pageIndex}`
          }
          item={item}
          active={item.type === 'page' && item.pageIndex === pageIndex}
          size={size}
          disabled={disabled}
          onGo={onGo}
        />
      ))}
    </>
  );
}

function PaginationWindowSlot(props: {
  readonly item: PaginationWindowItem;
  readonly active: boolean;
  readonly size: number;
  readonly disabled: boolean;
  readonly onGo: (pageIndex: number) => void;
}): ReactNode {
  const { item, active, size, disabled, onGo } = props;
  if (item.type === 'ellipsis') {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text sx={{ color: 'textSecondary', fontSize: 12 }} label="…" />
      </Box>
    );
  }
  const label = String(item.pageIndex + 1);
  return (
    <IconButton
      label={`Page ${label}`}
      size={size}
      background={active ? 'tintMuted' : 'surface'}
      tooltip="hover"
      disabled={disabled}
      onPress={() => onGo(item.pageIndex)}
    >
      <Text
        sx={{
          color: active ? 'tint' : 'textSecondary',
          fontSize: 11,
          fontWeight: active ? '600' : '400',
        }}
        label={label}
      />
    </IconButton>
  );
}
