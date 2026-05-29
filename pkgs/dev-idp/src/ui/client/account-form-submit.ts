import type { FormPayload } from './account-form-types';
import type { PanelStatus } from './account-form-status';

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

export async function submitAccountForm(
  ev: Event,
  onSubmit: (
    payload: FormPayload
  ) => Promise<{ ok: boolean; message?: string }>,
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
