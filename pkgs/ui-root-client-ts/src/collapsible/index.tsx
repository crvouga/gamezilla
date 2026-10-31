/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, type JSX, Show, untrack } from 'solid-js';
import { ChevronRightIcon } from '../icons';

export type CollapsibleProps = {
  title: string;
  defaultOpen?: boolean | undefined;
  renderIcon?: ((isOpen: boolean) => JSX.Element) | undefined;
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/** `Collapsible` -- disclosure row that toggles its body (`aria-expanded`). */
export function Collapsible(props: CollapsibleProps): JSX.Element {
  const [isOpen, setIsOpen] = createSignal(
    untrack(() => props.defaultOpen ?? false)
  );
  return (
    <div
      class="box"
      {...dataAttrs({ component: 'Collapsible', ...props.dataSet })}
    >
      <button
        class="clickable clickableTint flex-row items-center gap-2 py-2"
        type="button"
        aria-expanded={isOpen()}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Show
          when={props.renderIcon}
          fallback={
            <span
              class="box inline-flex"
              style={{
                transform: isOpen() ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronRightIcon size={16} />
            </span>
          }
        >
          {(render) => render()(isOpen())}
        </Show>
        <p class="text textBodyBold">{props.title}</p>
      </button>
      <Show when={isOpen()}>
        <div class="box ml-6 mb-2">{props.children}</div>
      </Show>
    </div>
  );
}
