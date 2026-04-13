import { useTheme } from '@gamezilla/shared/theme';
import {
  Box,
  ConfirmationModal,
  FlatList,
  Pressable,
  Text,
  TextInput,
} from '@gamezilla/shared/ui';
import { clearLocalDatabaseAndReload } from '@gamezilla/patch-db/bootstrap-expo';
import { useEntities, usePatchesDb } from '@gamezilla/patch-db/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { ScreenHeader } from '@/ui/screen-header';

const INBOX_LIST_ID = '__inbox__';

const TODO_LIST_DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'todoList/deleted' },
    { type: '=' as const, attribute: 'todoList/deleted', value: false },
  ],
};

const TODO_DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'todo/deleted' },
    { type: '=' as const, attribute: 'todo/deleted', value: false },
  ],
};

function useTodoCountByList() {
  const todosResult = useEntities({
    entityType: 'todo',
    where: TODO_DELETED_CLAUSE,
  });
  const counts = new Map<unknown, number>();
  for (const t of todosResult.entities) {
    const lid = t.attributes['todo/listId'] ?? INBOX_LIST_ID;
    counts.set(lid, (counts.get(lid) ?? 0) + 1);
  }
  return counts;
}

export function TodoListsOverview() {
  const theme = useTheme();
  const router = useRouter();
  const db = usePatchesDb();
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteDbModalVisible, setDeleteDbModalVisible] = useState(false);

  const listsResult = useEntities({
    entityType: 'todoList',
    where: TODO_LIST_DELETED_CLAUSE,
    orderBy: [
      { attribute: 'todoList/order', direction: 'asc' },
      { attribute: 'todoList/createdAt', direction: 'asc' },
      { attribute: 'todoList/id', direction: 'asc' },
    ],
  });
  const lists = listsResult.entities ?? [];
  const todoCounts = useTodoCountByList();

  const addList = async () => {
    const name = input.trim();
    if (!name) {
      setAdding(false);
      return;
    }
    const entityId = crypto.randomUUID();
    await db.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': name,
          'todoList/order': lists.length,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);
    setInput('');
    setAdding(false);
  };

  const openList = (listId: string) => {
    router.push(`/todos/${listId}`);
  };

  const deleteList = async (listId: string) => {
    await db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/deleted': true },
      },
    ]);
  };

  const confirmDelete = (item: { id: string; name: string }) => {
    setDeleteTarget(item);
  };

  const deleteLocalDatabase = async () => {
    setDeleteDbModalVisible(false);
    await clearLocalDatabaseAndReload('main');
  };

  const inboxCount = todoCounts.get(INBOX_LIST_ID) ?? 0;

  const listRows: { id: string; name: string; count: number }[] = [
    { id: INBOX_LIST_ID, name: 'Inbox', count: inboxCount },
    ...lists.map((l) => ({
      id: l.entityId,
      name: (() => {
        const nameRaw = l.attributes['todoList/name'];
        return typeof nameRaw === 'string' ? nameRaw : 'Untitled';
      })(),
      count: todoCounts.get(l.entityId) ?? 0,
    })),
  ];

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader
        title="Todo Lists"
        subtitle="Group your todos by list"
        end={
          <Pressable
            onPress={() => setDeleteDbModalVisible(true)}
            style={({ pressed }) => [
              theme.sx({ py: 2, px: 2, borderRadius: 8 }),
              pressed && theme.sx({ opacity: 0.7 }),
            ]}
          >
            <Text
              style={[
                theme.sx({ fontSize: 14 }),
                { color: theme.colors.destructive },
              ]}
            >
              Clear data
            </Text>
          </Pressable>
        }
      />
      <Box sx={{ flex: 1, p: 4 }}>
      {adding ? (
        <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
          <TextInput
            sx={{
              flex: 1,
              borderWidth: 1,
              borderRadius: 8,
              px: 3,
              py: 2.5,
              fontSize: 16,
              background: 'paper',
              color: 'text',
              borderColor: 'border',
            }}
            placeholder="List name..."
            placeholderTextColor={theme.colors.icon}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addList}
            onBlur={() => {
              if (!input.trim()) setAdding(false);
            }}
            autoFocus
          />
          <Pressable
            onPress={addList}
            style={theme.sx({ justifyContent: 'center', px: 4 })}
          >
            <Text variant="bodyBold">Add</Text>
          </Pressable>
        </Box>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={[
            theme.sx({
              py: 3,
              px: 4,
              borderRadius: 8,
              mb: 4,
              alignItems: 'center',
            }),
            { backgroundColor: theme.colors.tintMuted },
          ]}
        >
          <Text variant="bodyBold">+ New List</Text>
        </Pressable>
      )}

      <FlatList
        data={listRows}
        keyExtractor={(item) => item.id}
        style={theme.sx({ flex: 1 })}
        sx={{ pb: 24 }}
        renderItem={({ item }) => (
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              py: 3.5,
              px: 3,
              borderRadius: 8,
              mb: 1,
            }}
          >
            <Pressable
              onPress={() => openList(item.id)}
              style={({ pressed }) => [
                theme.sx({
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }),
                pressed && theme.sx({ opacity: 0.7 }),
              ]}
            >
              <Text style={theme.sx({ fontSize: 17, fontWeight: '500' })}>
                {item.name}
              </Text>
              <Text style={theme.sx({ fontSize: 15, opacity: 0.6 })}>
                {item.count}
              </Text>
            </Pressable>
            {item.id !== INBOX_LIST_ID && (
              <Pressable
                onPress={() => confirmDelete(item)}
                style={({ pressed }) => [
                  theme.sx({ p: 2, ml: 2 }),
                  pressed && theme.sx({ opacity: 0.7 }),
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    theme.sx({ fontSize: 14 }),
                    { color: theme.colors.tint },
                  ]}
                >
                  Delete
                </Text>
              </Pressable>
            )}
          </Box>
        )}
        ListEmptyComponent={
          <Text
            style={theme.sx({ opacity: 0.7, fontStyle: 'italic', mt: 6 })}
          >
            No lists yet. Create one above or add todos to Inbox.
          </Text>
        }
      />
      <ConfirmationModal
        visible={!!deleteTarget}
        title="Delete List"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) {
            deleteList(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmationModal
        visible={deleteDbModalVisible}
        title="Clear All Data"
        message="Are you sure you want to delete the local database? All todos and lists will be permanently removed. The app will reload."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={deleteLocalDatabase}
        onCancel={() => setDeleteDbModalVisible(false)}
      />
      </Box>
    </Box>
  );
}
