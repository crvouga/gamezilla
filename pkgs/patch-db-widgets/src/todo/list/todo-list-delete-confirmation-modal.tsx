import { MutationModal } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useTodoListDisplayName } from './todo-list-row-name-text';

export type TodoListDeleteConfirmationModalProps = {
  listId: string;
  visible: boolean;
  /** Runs the delete write. Surfaces loading / success / error in place. */
  operation: () => Promise<void>;
  onClose: () => void;
};

export function TodoListDeleteConfirmationModal({
  listId,
  visible,
  operation,
  onClose,
}: TodoListDeleteConfirmationModalProps): ReactNode {
  const { t } = useLingui();
  const name = useTodoListDisplayName(listId);
  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={t`Delete List`}
      message={
        visible
          ? t`Are you sure you want to delete "${name}"? This cannot be undone.`
          : ''
      }
      submitLabel={t`Delete`}
      variant="destructive"
      operation={operation}
      loadingLabel={t`Deleting…`}
      successTitle={t`List deleted`}
      errorTitle={t`Couldn't delete list`}
    />
  );
}
