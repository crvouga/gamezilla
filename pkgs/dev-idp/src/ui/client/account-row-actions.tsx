/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';

const stop =
  (handler: () => void) =>
  (ev: MouseEvent): void => {
    ev.stopPropagation();
    handler();
  };

const ConfirmDeleteButtons = (props: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <>
    <button
      type="button"
      class={c.iconBtn}
      data-row-action="confirm-delete"
      data-testid="dev-idp-account-confirm-delete"
      title="Confirm remove"
      aria-label="Confirm remove"
      onClick={stop(props.onConfirm)}
    >
      ✓
    </button>
    <button
      type="button"
      class={c.iconBtn}
      data-row-action="cancel-delete"
      data-testid="dev-idp-account-cancel-delete"
      title="Cancel remove"
      aria-label="Cancel remove"
      onClick={stop(props.onCancel)}
    >
      ↩
    </button>
  </>
);

const EditDeleteButtons = (props: {
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <>
    <button
      type="button"
      class={c.iconBtn}
      data-row-action="edit"
      data-testid="dev-idp-account-edit"
      title="Edit account"
      aria-label="Edit account"
      onClick={stop(props.onEdit)}
    >
      ✎
    </button>
    <button
      type="button"
      class={c.iconBtn}
      data-row-action="delete"
      data-testid="dev-idp-account-delete"
      title="Remove account"
      aria-label="Remove account"
      onClick={stop(props.onDelete)}
    >
      ✕
    </button>
  </>
);

export const AccountRowActions = (props: {
  pendingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
}) => (
  <div
    class={c.rowActions}
    data-row-actions
    data-testid="dev-idp-account-actions"
  >
    {props.pendingDelete ? (
      <ConfirmDeleteButtons
        onConfirm={props.onConfirmDelete}
        onCancel={props.onCancelDelete}
      />
    ) : (
      <EditDeleteButtons
        onEdit={props.onEdit}
        onDelete={props.onRequestDelete}
      />
    )}
  </div>
);
