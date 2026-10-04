/** @jsxImportSource solid-js */
/**
 * Modal building blocks: `ModalHeader` (names the dialog), `ModalBody`,
 * `ModalFooter` (stacked full-width actions), and `ModalButton`.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { Button } from './button';
import type { ButtonIntent, ButtonVariant } from './button-face';
import { useModalTitleId } from './modal-title-id';

export type ModalHeaderProps = {
  title: JSX.Element;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Title area; stamps the surface title id so the dialog is named by it. */
export function ModalHeader(props: ModalHeaderProps): JSX.Element {
  const titleId = useModalTitleId();
  return (
    <div
      class="box mb-3"
      {...dataAttrs({ component: 'ModalHeader', ...props.dataSet })}
    >
      <h2 class="text textSubtitle text-text" id={titleId}>
        {props.title}
      </h2>
    </div>
  );
}

export type ModalBodyProps = {
  /** Plain copy; takes precedence over `children`. */
  message?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

export function ModalBody(props: ModalBodyProps): JSX.Element {
  const hasMessage = (): boolean =>
    props.message !== undefined && props.message !== null;
  return (
    <div
      class="box mb-4"
      {...dataAttrs({ component: 'ModalBody', ...props.dataSet })}
    >
      <Show when={hasMessage()} fallback={props.children}>
        <p class="text text-text">{props.message}</p>
      </Show>
    </div>
  );
}

export type ModalFooterProps = {
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  children?: JSX.Element | undefined;
};

/**
 * Action column at the bottom of a modal: children stack vertically with each
 * action stretched to the full content width.
 */
export function ModalFooter(props: ModalFooterProps): JSX.Element {
  return (
    <div
      class="box flex-col items-stretch gap-2 mt-2"
      {...dataAttrs({ component: 'ModalFooter', ...props.dataSet })}
    >
      {props.children}
    </div>
  );
}

export type ModalButtonVariant = 'default' | 'cancel' | 'destructive';

export type ModalButtonProps = {
  label: JSX.Element;
  /** `default` → solid primary, `destructive` → solid danger, `cancel` → ghost neutral. */
  variant?: ModalButtonVariant | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const MODAL_BUTTON_FACE: Record<
  ModalButtonVariant,
  { intent: ButtonIntent; variant: ButtonVariant }
> = {
  default: { intent: 'primary', variant: 'solid' },
  destructive: { intent: 'danger', variant: 'solid' },
  cancel: { intent: 'neutral', variant: 'ghost' },
};

/** Action button used inside {@link ModalFooter}; backed by {@link Button}. */
export function ModalButton(props: ModalButtonProps): JSX.Element {
  const face = () => MODAL_BUTTON_FACE[props.variant ?? 'default'];
  return (
    <Button
      title={props.label}
      intent={face().intent}
      variant={face().variant}
      size="md"
      onClick={() => props.onClick()}
      disabled={props.disabled ?? false}
      dataSet={{ component: 'ModalButton', ...props.dataSet }}
    />
  );
}
