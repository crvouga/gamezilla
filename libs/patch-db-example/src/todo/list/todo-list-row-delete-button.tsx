import { Pressable, Text, useTheme } from '@gamezilla/lib/ui';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import { INBOX_LIST_ID, TodoListAttr } from '../domain/todo-constants';
import { TodoListDeleteConfirmationModal } from './todo-list-delete-confirmation-modal';

export type TodoListRowDeleteButtonProps = {
  listId: string;
};

export function TodoListRowDeleteButton({
  listId,
}: TodoListRowDeleteButtonProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const db = usePatchDb();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (listId === INBOX_LIST_ID) return null;

  const confirmDelete = async () => {
    setConfirmOpen(false);
    await db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: TodoListAttr.deleted(true),
      },
    ]);
  };

  return (
    <>
      <Pressable
        onPress={() => setConfirmOpen(true)}
        style={({ pressed }) => [
          theme.sx({ p: 2, ml: 2 }),
          pressed && theme.sx({ opacity: 0.7 }),
        ]}
        hitSlop={8}
      >
        <Text
          style={[theme.sx({ fontSize: 14 }), { color: theme.colors.tint }]}
          label={t`Delete`}
        />
      </Pressable>
      <TodoListDeleteConfirmationModal
        listId={listId}
        visible={confirmOpen}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
