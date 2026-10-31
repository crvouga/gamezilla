import { Trans } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import type { ButtonVariant } from '../button-face';
import { useMutationButton } from '../use-mutation-button/index';

/**
 * Consistent inline progress, acknowledgement and retry for game commands.
 * `solid` is the one thing to do next, in the primary fill; every other command is a
 * neutral outline, so a row of them never competes with it.
 */
export function GameActionButton(props: {
  title: JSX.Element;
  operation: () => Promise<void>;
  disabled?: boolean;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  successLabel?: JSX.Element;
  dataSet?: ComponentDataSet;
}): JSX.Element {
  const action = useMutationButton({
    operation: () => props.operation(),
    labels: {
      get idle() {
        return props.title;
      },
      loading: <Trans>Working…</Trans>,
      get success() {
        return (
          <Show when={props.successLabel} fallback={<Trans>Done</Trans>}>
            {props.successLabel}
          </Show>
        );
      },
      error: <Trans>Try again</Trans>,
    },
    get disabled() {
      return props.disabled;
    },
  });
  return (
    <Button
      {...action.buttonProps}
      variant={props.variant ?? 'outline'}
      intent={props.variant === 'solid' ? 'primary' : 'neutral'}
      fullWidth={props.fullWidth}
      dataSet={props.dataSet}
    />
  );
}
