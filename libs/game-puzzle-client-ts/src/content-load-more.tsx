import { Button } from '@pkgs/ui-root-client-ts/button';
import { type Accessor, type JSX, Show } from 'solid-js';

export function ContentLoadMore(props: {
  page: { hasMore: Accessor<boolean>; more: () => void };
  label: string;
  disabled?: boolean;
  testId?: string;
}): JSX.Element {
  return (
    <Show when={props.page.hasMore()}>
      <Button
        title={props.label}
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
        dataSet={
          props.testId === undefined ? undefined : { testid: props.testId }
        }
        onClick={() => props.page.more()}
      />
    </Show>
  );
}
