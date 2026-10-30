import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, createUniqueId, type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { ChevronDownIcon } from '../icons';

/** Secondary choices stay in context, with native keyboard and focus semantics. */
export function GameDisclosure(props: {
  title: JSX.Element;
  children: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const id = createUniqueId();
  return (
    <div
      class={styles['disclosure']}
      {...dataAttrs({ component: 'GameDisclosure' })}
    >
      <button
        type="button"
        class={`${styles['disclosureTrigger']} text textLabel`}
        aria-expanded={open()}
        aria-controls={id}
        onClick={() => setOpen(!open())}
        {...dataAttrs({ component: 'GameDisclosureTrigger', ...props.dataSet })}
      >
        {props.title}
        <span class={styles['chevron']} data-open={open()} aria-hidden="true">
          <ChevronDownIcon size={18} />
        </span>
      </button>
      <Show when={open()}>
        <div id={id} class={styles['disclosureBody']}>
          {props.children}
        </div>
      </Show>
    </div>
  );
}
