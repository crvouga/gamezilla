import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Collapsible as Disclosure, CollapsibleTrigger, CollapsiblePanel } from '@ui-sdk/solid/collapsible';
import { createSignal } from 'solid-js';
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
  return (
    <Disclosure
      open={open()}
      onOpenChange={setOpen}
      class={styles['disclosure']}
      data-rule={String(props.rule !== false)}
      {...dataAttrs({ component: 'GameDisclosure' })}
    >
      <CollapsibleTrigger
        type="button"
        class={`${styles['disclosureTrigger']} text textLabel`}
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
      </CollapsibleTrigger>
      <CollapsiblePanel class={styles['disclosureBody']}>{props.children}</CollapsiblePanel>
    </Disclosure>
  );
}
