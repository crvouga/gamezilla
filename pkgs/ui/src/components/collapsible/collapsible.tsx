/** @jsxImportSource solid-js */
/** `Collapsible` -- disclosure row that toggles its body (`aria-expanded`). */

import { createSignal, type JSX, Show, untrack } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronRightIcon } from '../icons';
import { Text } from '../text';

export type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean | undefined;
  renderIcon?: ((isOpen: boolean) => JSX.Element) | undefined;
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

export function Collapsible(props: CollapsibleProps): JSX.Element {
  const [isOpen, setIsOpen] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );
  return (
    <Box dataSet={{ component: 'Collapsible', ...props.dataSet }}>
      <Clickable
        aria-expanded={isOpen()}
        onClick={() => setIsOpen((v) => !v)}
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, py: 2 }}
      >
        <Show
          when={props.renderIcon}
          fallback={
            <ChevronRightIcon
              size={16}
              sx={{
                transform: [{ rotate: isOpen() ? '90deg' : '0deg' }],
                transitionProperty: 'transform',
                transitionDuration: 'var(--ui-duration-fast)',
              }}
            />
          }
        >
          {(render) => render()(isOpen())}
        </Show>
        <Text variant="bodyBold" label={props.title} />
      </Clickable>
      <Show when={isOpen()}>
        <Box sx={{ ml: 6, mb: 2 }}>{props.children}</Box>
      </Show>
    </Box>
  );
}
