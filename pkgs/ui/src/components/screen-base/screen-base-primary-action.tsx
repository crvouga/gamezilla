import type { ReactNode } from 'react';

import {
  type MutationButtonProps,
  type MutationFabProps,
  useMutationButton,
} from '../button/use-mutation-button';
import type { ScreenBasePrimaryAction } from './screen-base-types';

export type ScreenBasePrimaryActionRenderProps = {
  buttonProps: MutationButtonProps;
  fabProps: MutationFabProps;
  icon: ScreenBasePrimaryAction['icon'];
};

export function ScreenBasePrimaryActionMutation({
  config,
  children,
}: {
  config: ScreenBasePrimaryAction;
  children: (props: ScreenBasePrimaryActionRenderProps) => ReactNode;
}): ReactNode {
  const mutation = useMutationButton({
    operation: config.operation,
    labels: config.labels,
    onSuccess: config.onSuccess,
    onError: config.onError,
    disabled: config.disabled,
    successHoldMs: config.successHoldMs,
  });

  return children({
    buttonProps: mutation.buttonProps,
    fabProps: {
      ...mutation.fabProps,
      ...(config.testID !== undefined ? { testID: config.testID } : {}),
    },
    icon: config.icon,
  });
}
