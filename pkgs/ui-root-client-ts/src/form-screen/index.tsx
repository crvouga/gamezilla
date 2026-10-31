import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createUniqueId, type JSX } from 'solid-js';
import { ContentScreen } from '../content-screen/index';
import {
  type FormActionsFooterProps,
  FormActionsFooterView,
  useFormActions,
} from '../form-actions-footer/index';
import type { ScreenBaseProps } from '../screen-base-types';
import styles from '../screen-layouts.module.css';

export type FormScreenProps = Pick<
  ScreenBaseProps,
  'screenId' | 'breadcrumbs' | 'dataSet'
> &
  Pick<FormActionsFooterProps, 'submit' | 'cancel'> & {
    children: JSX.Element;
  };

/** Scrollable editor with Save / Cancel in the canonical screen footer. */
export function FormScreen(props: FormScreenProps): JSX.Element {
  const formId = createUniqueId();
  const mutation = useFormActions(props);
  const submit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault();
    const phase = mutation.feedback();
    if (
      mutation.buttonProps.disabled ||
      phase === 'loading' ||
      phase === 'success'
    )
      return;
    if (event.currentTarget.checkValidity()) void mutation.run();
  };
  return (
    <form
      id={formId}
      class={styles['form']}
      onSubmit={submit}
      {...dataAttrs({ component: 'ScreenForm' })}
    >
      <ContentScreen
        screenId={props.screenId}
        breadcrumbs={props.breadcrumbs}
        width="menu"
        dataSet={{ component: 'FormScreen', ...props.dataSet }}
        footer={
          <FormActionsFooterView
            submit={props.submit}
            cancel={props.cancel}
            mutation={mutation}
            submitMode="form"
          />
        }
      >
        {props.children}
      </ContentScreen>
    </form>
  );
}
