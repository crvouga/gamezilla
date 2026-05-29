/** @jsxImportSource hono/jsx/dom */
import { useEffect, useState } from 'hono/jsx';

import { c } from '../styles';
import type { AccountPanelMode, FormPayload } from './account-form-types';
import { AccountPanelForm } from './account-panel-form';
import type { PanelStatus } from './account-form-status';

export type { AccountPanelMode, FormPayload } from './account-form-types';

export const AccountPanel = (props: {
  mode: AccountPanelMode;
  onCancel: () => void;
  onSubmit: (
    payload: FormPayload
  ) => Promise<{ ok: boolean; message?: string }>;
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
      <AccountPanelForm
        testIdRoot={testIdRoot}
        isEdit={isEdit}
        initial={initial}
        status={status}
        onCancel={props.onCancel}
        onSubmit={props.onSubmit}
        setStatus={setStatus}
      />
    </section>
  );
};
