import { useEffect, useState } from 'hono/jsx';

import type { DevIdpClientConfig } from '../page';
import type { AccountListState } from './account-list';
import type { AccountPanelMode, FormPayload } from './account-forms';
import { submitSignInForm } from './sign-in-form';
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type DevIdpUser,
} from './users-api';

function bodyAppState(list: AccountListState): string {
  if (list.kind !== 'loaded') return list.kind;
  return list.users.length === 0 ? 'empty' : 'ready';
}

export function useChooserState(config: DevIdpClientConfig) {
  const [list, setList] = useState<AccountListState>(() =>
    config.initialUsers.length > 0
      ? { kind: 'loaded', users: config.initialUsers }
      : { kind: 'loading' }
  );
  const [panel, setPanel] = useState<AccountPanelMode>({ kind: 'closed' });
  const [pendingDeleteSub, setPendingDeleteSub] = useState<string | null>(null);

  useEffect(() => {
    document.body.setAttribute('data-app-state', bodyAppState(list));
  }, [list]);

  const refresh = async (): Promise<readonly DevIdpUser[] | null> => {
    const r = await listUsers(config.usersApiPath);
    if (r.ok) {
      setList({ kind: 'loaded', users: r.users });
      return r.users;
    }
    setList({ kind: 'error', message: r.message });
    return null;
  };

  useEffect(() => {
    void refresh();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- mount only */
  }, []);

  const onSignIn = (sub: string): void => {
    submitSignInForm(config.completeActionPath, config.oauthParams, sub);
  };

  const onEdit = (sub: string): void => {
    if (list.kind !== 'loaded') return;
    const u = list.users.find((row) => row.sub === sub);
    if (u === undefined) return;
    setPendingDeleteSub(null);
    setPanel({ kind: 'edit', user: u });
  };

  const submitPanel = async (
    payload: FormPayload
  ): Promise<{ ok: boolean; message?: string }> => {
    if (panel.kind === 'closed') return { ok: false, message: 'no open panel' };
    const r =
      panel.kind === 'edit'
        ? await updateUser(config.usersApiPath, panel.user.sub, payload)
        : await createUser(config.usersApiPath, payload);
    if (!r.ok) return { ok: false, message: r.message };
    setPanel({ kind: 'closed' });
    await refresh();
    return { ok: true };
  };

  return {
    list,
    panel,
    pendingDeleteSub,
    setPanel,
    setPendingDeleteSub,
    onSignIn,
    onEdit,
    submitPanel,
    confirmDelete: async (sub: string): Promise<void> => {
      setPendingDeleteSub(null);
      await deleteUser(config.usersApiPath, sub);
      await refresh();
    },
  };
}
