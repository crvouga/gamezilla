import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import type { JSX } from 'solid-js';

export function CustomGameAction(props: {
  title: JSX.Element;
  operation: () => Promise<void>;
  testId: string;
  disabled?: boolean;
}): JSX.Element {
  const action = useMutationButton({
    operation: () => props.operation(),
    labels: {
      get idle() {
        return props.title;
      },
      loading: <Trans>Confirming…</Trans>,
      success: <Trans>Confirmed</Trans>,
      error: <Trans>Try again</Trans>,
    },
    get disabled() {
      return props.disabled;
    },
  });
  return (
    <Button
      {...action.buttonProps}
      variant="outline"
      dataSet={{ testid: props.testId }}
    />
  );
}
