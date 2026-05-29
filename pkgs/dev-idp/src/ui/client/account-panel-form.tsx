/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';
import { AccountFormFields } from './account-form-fields';
import {
  panelStatusState,
  panelStatusText,
  type PanelStatus,
} from './account-form-status';
import type { FormPayload } from './account-form-types';
import { submitAccountForm } from './account-form-submit';

export const AccountPanelForm = (props: {
  testIdRoot: string;
  isEdit: boolean;
  initial: { name: string; email: string; picture: string };
  status: PanelStatus;
  onCancel: () => void;
  onSubmit: (
    payload: FormPayload
  ) => Promise<{ ok: boolean; message?: string }>;
  setStatus: (s: PanelStatus) => void;
}) => (
  <form
    data-testid={`${props.testIdRoot}-form`}
    onSubmit={(ev: Event) => {
      void submitAccountForm(ev, props.onSubmit, props.setStatus);
    }}
  >
    <AccountFormFields testIdRoot={props.testIdRoot} initial={props.initial} />
    <div class={c.panelActions}>
      <button
        type="submit"
        class={c.submitBtn}
        data-testid={`${props.testIdRoot}-submit`}
        disabled={props.status.kind === 'submitting'}
      >
        {props.isEdit ? 'Save' : 'Add account'}
      </button>
      <button
        type="button"
        class={c.btn}
        data-testid={`${props.testIdRoot}-cancel`}
        disabled={props.status.kind === 'submitting'}
        onClick={props.onCancel}
      >
        Cancel
      </button>
      <span
        class={c.status}
        role="status"
        aria-live="polite"
        data-state={panelStatusState(props.status)}
        data-testid={`${props.testIdRoot}-status`}
      >
        {panelStatusText(props.status, props.isEdit)}
      </span>
    </div>
  </form>
);
