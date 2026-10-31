/** @jsxImportSource solid-js */
/**
 * Primary screen action: one `useMutationButton` lifecycle shared by the
 * compact FAB and the wide header `Button`.
 */

import { type Accessor, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button } from '../button/index';
import type { IconComponent } from '../create-icon/index';
import { FloatingActionButton } from '../floating-action-button/index';
import { PlusIcon } from '../icons';
import type { ScreenBasePrimaryAction } from '../screen-base-types';
import type {
  MutationButtonProps,
  MutationFabProps,
} from '../use-mutation-button/index';
import { useMutationButton } from '../use-mutation-button/index';

export type ScreenBasePrimaryActionRender = {
  buttonProps: MutationButtonProps;
  fabProps: MutationFabProps;
  icon: Accessor<IconComponent | undefined>;
  dataSet: Accessor<ScreenBasePrimaryAction['dataSet']>;
};

export function useScreenBasePrimaryAction(
  config: Accessor<ScreenBasePrimaryAction>
): ScreenBasePrimaryActionRender {
  const mutation = useMutationButton({
    operation: () => config().operation(),
    get labels() {
      return config().labels;
    },
    onSuccess: () => config().onSuccess?.(),
    onError: (error) => config().onError?.(error),
    get disabled() {
      return config().disabled;
    },
    get successHoldMs() {
      return config().successHoldMs;
    },
  });
  return {
    buttonProps: mutation.buttonProps,
    fabProps: mutation.fabProps,
    icon: () => config().icon,
    dataSet: () => config().dataSet,
  };
}

export type WithScreenBasePrimaryActionProps = {
  config: ScreenBasePrimaryAction | undefined;
  children: (render: ScreenBasePrimaryActionRender | undefined) => JSX.Element;
};

/** Runs the mutation lifecycle only when a primary action is configured. */
export function WithScreenBasePrimaryAction(
  props: WithScreenBasePrimaryActionProps
): JSX.Element {
  return (
    <Show when={props.config} fallback={props.children(undefined)}>
      {(config) => props.children(useScreenBasePrimaryAction(config))}
    </Show>
  );
}

/** Idle-disabled actions hide entirely (matches the RN shell). */
export function primaryActionVisible(
  render: ScreenBasePrimaryActionRender | undefined
): boolean {
  return render !== undefined && render.buttonProps.disabled !== true;
}

export function ScreenBasePrimaryFab(props: {
  render: ScreenBasePrimaryActionRender;
}): JSX.Element {
  return (
    <FloatingActionButton
      {...props.render.fabProps}
      icon={props.render.icon() ?? PlusIcon}
      dataSet={{
        component: 'ScreenBasePrimaryAction',
        ...props.render.dataSet(),
      }}
    />
  );
}

export function ScreenBasePrimaryButton(props: {
  render: ScreenBasePrimaryActionRender;
}): JSX.Element {
  return (
    <Button
      intent="primary"
      {...props.render.buttonProps}
      startIcon={
        <Show when={props.render.icon()}>
          {(icon) => <Dynamic component={icon()} size={18} />}
        </Show>
      }
      dataSet={{
        component: 'ScreenBasePrimaryAction',
        ...props.render.dataSet(),
      }}
    />
  );
}
