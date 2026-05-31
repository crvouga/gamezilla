import { ConfirmationModal } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useTodoListDisplayName } from './todo-list-row-name-text';

export type TodoListDeleteConfirmationModalProps = {
  listId: string;
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TodoListDeleteConfirmationModal({
  listId,
  visible,
  onConfirm,
  onCancel,
}: TodoListDeleteConfirmationModalProps): ReactNode {
  const { t } = useLingui();
  const name = useTodoListDisplayName(listId);
  return (
    <ConfirmationModal
      visible={visible}
      title={t`Delete List`}
      message={
        visible
          ? t`Are you sure you want to delete "${name}"? This cannot be undone.`
          : ''
      }
      confirmLabel={t`Delete`}
      cancelLabel={t`Cancel`}
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
