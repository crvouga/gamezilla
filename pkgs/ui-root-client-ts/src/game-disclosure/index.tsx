import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { createSignal, createUniqueId, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { ChevronDownIcon } from '../icons';

/**
 * Secondary choices stay in context, with native keyboard and focus
 * semantics. A hairline heads it, setting it apart from what is above;
 * `rule={false}` drops it where a card's own footer rule already does.
 */
export function GameDisclosure(props: {
  title: JSX.Element;
  children: JSX.Element;
  rule?: boolean | undefined;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const id = createUniqueId();
  return (
    <div
      class={styles['disclosure']}
      data-rule={String(props.rule !== false)}
      {...dataAttrs({ component: 'GameDisclosure' })}
    >
      <button
        type="button"
        class={`${styles['disclosureTrigger']} text textLabel`}
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={id}
        onClick={() => setOpen(!open())}
        {...dataAttrs({ component: 'GameDisclosureTrigger', ...props.dataSet })}
      >
        {props.title}
        <span
          class={styles['chevron']}
          data-open={String(open())}
          aria-hidden="true"
        >
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
