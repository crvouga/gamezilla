/** @jsxImportSource solid-js */
/**
 * Single folder-shaped tab cell for `TabStrip`.
 *
 * Layout is identical for active / inactive: same border box, height, padding,
 * font weight, and reserved separator / close slots. Visual differences are
 * color / opacity / an out-of-flow hairline cover only. The tab and its close
 * control are sibling `<button>`s inside one chrome shell (buttons cannot
 * nest in HTML).
 */

import { useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import { joinClass } from '../box/box';
import { Clickable } from '../clickable';
import { XIcon } from '../icons';
import { Text } from '../text';
import styles from './tab-strip.module.css';
import type { TabStripItem } from './tab-strip-types';

export const TAB_MIN_HEIGHT = 32;
export const TAB_MIN_WIDTH = 88;
export const TAB_MAX_WIDTH = 220;

export type TabStripTabProps = {
  readonly item: TabStripItem;
  readonly active: boolean;
  /** When true, keep a fixed separator gutter (opacity follows `separatorVisible`). */
  readonly reserveSeparatorBefore: boolean;
  readonly separatorVisible: boolean;
  readonly onSelect: (id: string) => void;
  readonly ref?: ((el: HTMLElement) => void) | undefined;
  /** DOM id of the tab, for `aria-controls` / `aria-labelledby` wiring. */
  readonly tabId?: string | undefined;
};

function shellChromeSx(closable: boolean, active: boolean): SxProps {
  return {
    position: 'relative',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: TAB_MIN_HEIGHT,
    minWidth: TAB_MIN_WIDTH,
    maxWidth: TAB_MAX_WIDTH,
    paddingRight: closable ? 2 : 0,
    borderTopLeftRadius: 'md',
    borderTopRightRadius: 'md',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    borderColor: active ? 'border' : 'transparent',
    backgroundColor: active ? 'background' : 'transparent',
    zIndex: active ? 1 : 0,
  };
}

const separatorSx: SxProps = {
  width: 1,
  height: 14,
  marginHorizontal: 2,
  backgroundColor: 'border',
  flexShrink: 0,
};

const iconSlotSx: SxProps = {
  width: 14,
  height: 14,
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const closeSx: SxProps = {
  borderRadius: 'sm',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 22,
  height: 22,
};

const hairlineCoverSx: SxProps = {
  position: 'absolute',
  left: 1,
  right: 1,
  bottom: -1,
  height: 2,
  backgroundColor: 'background',
  zIndex: 2,
  pointerEvents: 'none',
};

export function TabStripTab(props: TabStripTabProps): JSX.Element {
  const { t } = useLingui();
  const closable = (): boolean => props.item.onClose !== undefined;
  const fg = (): string => (props.active ? 'text' : 'textSecondary');
  return (
    <Box
      ref={props.ref}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        height: TAB_MIN_HEIGHT,
      }}
      dataSet={{ component: 'TabStripCell', id: props.item.id }}
    >
      <Show when={props.reserveSeparatorBefore}>
        <Box
          aria-hidden="true"
          sx={[separatorSx, { opacity: props.separatorVisible ? 1 : 0 }]}
        />
      </Show>
      <Box
        class={joinClass(styles['shell'], props.active && styles['active'])}
        sx={shellChromeSx(closable(), props.active)}
      >
        <Clickable
          id={props.tabId}
          role="tab"
          aria-selected={props.active}
          tabIndex={props.active ? 0 : -1}
          feedback={props.active ? 'none' : 'tint'}
          onClick={() => props.onSelect(props.item.id)}
          dataSet={{ component: 'TabStripTab', id: props.item.id }}
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 1.5,
            height: TAB_MIN_HEIGHT - 2,
            paddingLeft: 5,
            paddingRight: closable() ? 2 : 5,
            borderTopLeftRadius: 'md',
            borderTopRightRadius: 'md',
            overflow: 'hidden',
            backgroundColor: 'transparent',
          }}
        >
          <Show when={props.item.icon}>
            {(icon) => (
              <Box sx={iconSlotSx}>
                <Dynamic
                  component={icon()}
                  size={14}
                  color={props.active ? 'tint' : 'textSecondary'}
                />
              </Box>
            )}
          </Show>
          <Text
            variant="label"
            label={props.item.label}
            numberOfLines={1}
            sx={{
              flexShrink: 1,
              color: fg(),
              fontWeight: '600',
              lineHeight: 18,
            }}
          />
        </Clickable>
        <Show when={closable()}>
          <Clickable
            class={styles['close']}
            aria-label={t`Close`}
            tabIndex={-1}
            onClick={() => props.item.onClose?.()}
            dataSet={{ component: 'TabStripClose', id: props.item.id }}
            sx={closeSx}
          >
            <XIcon size={12} color="textSecondary" />
          </Clickable>
        </Show>
        <Show when={props.active}>
          <Box aria-hidden="true" sx={hairlineCoverSx} />
        </Show>
      </Box>
    </Box>
  );
}
