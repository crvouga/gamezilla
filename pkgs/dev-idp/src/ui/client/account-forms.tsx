/** @jsxImportSource hono/jsx/dom */
import { useEffect, useState } from 'hono/jsx';

import { c } from '../styles';
import { AccountFormFields } from './account-form-fields';
import {
  panelStatusState,
  panelStatusText,
  type PanelStatus,
} from './account-form-status';
import type { DevIdpUser } from './users-api';

export type FormPayload = {
  readonly name: string;
  readonly email: string;
  readonly picture: string | null;
};

type Mode =
  | { readonly kind: 'closed' }
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly user: DevIdpUser };

const normalize = (
  formData: FormData
): FormPayload | { readonly error: string } => {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const pictureRaw = String(formData.get('picture') ?? '').trim();
  if (name.length === 0) return { error: 'name is required' };
  if (email.length === 0) return { error: 'email is required' };
  return {
    name,
    email,
    picture: pictureRaw.length > 0 ? pictureRaw : null,
  };
};

async function submitAccountForm(
  ev: Event,
  onSubmit: (payload: FormPayload) => Promise<{ ok: boolean; message?: string }>,
  setStatus: (s: PanelStatus) => void
): Promise<void> {
  ev.preventDefault();
  const form = ev.currentTarget as HTMLFormElement;
  const payload = normalize(new FormData(form));
  if ('error' in payload) {
    setStatus({ kind: 'error', message: payload.error });
    return;
  }
  setStatus({ kind: 'submitting' });
  const r = await onSubmit(payload);
  if (r.ok) {
    form.reset();
    setStatus({ kind: 'idle' });
  } else {
    setStatus({ kind: 'error', message: r.message ?? 'request failed' });
  }
}

export const AccountPanel = (props: {
  mode: Mode;
  onCancel: () => void;
  onSubmit: (payload: FormPayload) => Promise<{ ok: boolean; message?: string }>;
}) => {
  const { mode } = props;
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });

  useEffect(() => {
    if (mode.kind !== 'closed') setStatus({ kind: 'idle' });
  }, [mode.kind]);

  if (mode.kind === 'closed') return null;

  const isEdit = mode.kind === 'edit';
  const initial = isEdit
    ? {
        name: mode.user.name,
        email: mode.user.email,
        picture: mode.user.picture ?? '',
      }
    : { name: '', email: '', picture: '' };
  const testIdRoot = isEdit ? 'dev-idp-edit-panel' : 'dev-idp-create-panel';

  return (
    <section
      class={c.panel}
      data-state="open"
      data-testid={testIdRoot}
      aria-label={isEdit ? 'Edit account' : 'Add another account'}
    >
      <h2 class={c.panelTitle}>
        {isEdit ? 'Edit account' : 'Add another account'}
      </h2>
      <form
        data-testid={`${testIdRoot}-form`}
        onSubmit={(ev: Event) => {
          void submitAccountForm(ev, props.onSubmit, setStatus);
        }}
      >
        <AccountFormFields testIdRoot={testIdRoot} initial={initial} />
        <div class={c.panelActions}>
          <button
            type="submit"
            class={c.submitBtn}
            data-testid={`${testIdRoot}-submit`}
            disabled={status.kind === 'submitting'}
          >
            {isEdit ? 'Save' : 'Add account'}
          </button>
          <button
            type="button"
            class={c.btn}
            data-testid={`${testIdRoot}-cancel`}
            disabled={status.kind === 'submitting'}
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <span
            class={c.status}
            role="status"
            aria-live="polite"
            data-state={panelStatusState(status)}
            data-testid={`${testIdRoot}-status`}
          >
            {panelStatusText(status, isEdit)}
          </span>
        </div>
      </form>
    </section>
  );
};

export type { Mode as AccountPanelMode };
