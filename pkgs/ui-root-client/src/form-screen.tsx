import type { JSX } from 'solid-js';
import {
  FormActionsFooter,
  type FormActionsFooterProps,
} from './form-actions-footer';
import { ScreenBase } from './screen-base';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenColumn } from './screen-column';

export type FormScreenProps = Pick<
  ScreenBaseProps,
  'screenId' | 'breadcrumbs' | 'dataSet'
> &
  Pick<FormActionsFooterProps, 'submit' | 'cancel'> & {
    children: JSX.Element;
  };

/** Scrollable editor with Save / Cancel in the canonical screen footer. */
export function FormScreen(props: FormScreenProps): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      dataSet={{ component: 'FormScreen', ...props.dataSet }}
      scroll
      footer={
        <ScreenColumn>
          <FormActionsFooter submit={props.submit} cancel={props.cancel} />
        </ScreenColumn>
      }
      content={() => <ScreenColumn>{props.children}</ScreenColumn>}
    />
  );
}
