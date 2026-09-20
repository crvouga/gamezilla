/** Back arrow; rendered only when there is a previous step to return to. */

import { Show } from 'solid-js';

import { IDP_TEST_IDS } from '../../../src/shared/test-ids';
import { Icon } from './icon';

export function StepBack(props: {
  readonly href: string | null;
  /** Leaves the SPA for the provider's own `/back` document. */
  readonly open: (url: string) => void;
}) {
  return (
    <Show when={props.href}>
      {(href) => (
        <a
          class="inline-flex size-8 items-center justify-center rounded-lg text-idp-on-surface hover:bg-idp-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-idp-primary"
          href={href()}
          rel="external"
          aria-label="Back"
          data-testid={IDP_TEST_IDS.back}
          onClick={(event) => {
            event.preventDefault();
            props.open(href());
          }}
        >
          <Icon name="back" class="size-5" />
        </a>
      )}
    </Show>
  );
}
