/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';
import type { DevIdpClientConfig } from '../page';
import { AccountList } from './account-list';
import { AddAccountTrigger } from './add-account-trigger';
import { AccountPanel } from './account-forms';
import { useChooserState } from './use-chooser-state';

export const ChooserApp = (props: { config: DevIdpClientConfig }) => {
  const state = useChooserState(props.config);
  return (
    <>
      <div
        class={c.sectionLabel}
        data-testid="dev-idp-accounts-label"
        id="dev-idp-accounts-label"
      >
        Choose an account
      </div>
      <AccountList
        list={state.list}
        pendingDeleteSub={state.pendingDeleteSub}
        onSignIn={state.onSignIn}
        onEdit={state.onEdit}
        onRequestDelete={(sub) => {
          state.setPanel({ kind: 'closed' });
          state.setPendingDeleteSub(sub);
        }}
        onConfirmDelete={(sub) => void state.confirmDelete(sub)}
        onCancelDelete={() => state.setPendingDeleteSub(null)}
      />
      <AddAccountTrigger
        expanded={state.panel.kind === 'create'}
        onToggle={() => {
          state.setPendingDeleteSub(null);
          state.setPanel(
            state.panel.kind === 'create'
              ? { kind: 'closed' }
              : { kind: 'create' }
          );
        }}
      />
      <AccountPanel
        mode={state.panel}
        onCancel={() => state.setPanel({ kind: 'closed' })}
        onSubmit={state.submitPanel}
      />
    </>
  );
};
