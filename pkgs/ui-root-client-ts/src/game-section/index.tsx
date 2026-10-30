import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX, Show } from 'solid-js';
import styles from '../game-ui.module.css';
import { createScreenSlot } from '../screen-slot';

/**
 * Named game content section with optional description and footer. Compose game controls in its body; the generated heading labels the section for assistive technology.
 */
export function GameSection(props: {
  title: JSX.Element;
  description?: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const id = createUniqueId();
  const description = createScreenSlot(() => props.description);
  const footer = createScreenSlot(() => props.footer);
  return (
    <section
      class={`${styles['section']} rounded-card border border-border bg-surface`}
      aria-labelledby={id}
      {...dataAttrs({ component: 'GameSection', ...props.dataSet })}
    >
      <div class="box gap-1">
        <h2 id={id} class="text textNavigationTitle">
          {props.title}
        </h2>
        <Show when={description.present()}>
          <p class="text textBody text-text-secondary">
            {description.content()}
          </p>
        </Show>
      </div>
      {props.children}
      <Show when={footer.present()}>
        <div class={styles['sectionFooter']}>{footer.content()}</div>
      </Show>
    </section>
  );
}

export function GameActions(props: { children: JSX.Element }): JSX.Element {
  const content = createScreenSlot(() => props.children);
  return (
    <Show when={content.present()}>
      <div
        class={styles['actions']}
        {...dataAttrs({ component: 'GameActions' })}
      >
        {content.content()}
      </div>
    </Show>
  );
}
