/** The inline error card: `role="alert"`, referenced by the field's aria. */

import { Icon } from './icon';

export function ErrorNote(props: {
  readonly id: string;
  readonly testId: string;
  readonly children: string;
}) {
  return (
    <p
      id={props.id}
      role="alert"
      data-testid={props.testId}
      class="flex items-start gap-2 text-sm text-gm-error"
    >
      <Icon name="alert" class="mt-0.5 size-4 shrink-0" />
      <span>{props.children}</span>
    </p>
  );
}
