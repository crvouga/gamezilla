import { clearLocalDatabaseAndReload } from '@/@shared/patch-db/bootstrap-expo';
import type { Entity } from '@/@shared/patch-db/interface';
import { useEntities, usePatchesDb } from '@/@shared/patch-db/react';
import { useTheme } from '@/@shared/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ConfirmationModal } from '@/components/ui/modal';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, TextInput } from 'react-native';

const INBOX_LIST_ID = '__inbox__';

const DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'deleted' },
    { type: '=' as const, attribute: 'deleted', value: false },
  ],
};

type TodoListEntity = Entity & {
  attributes: { name?: string; order?: number; createdAt?: string };
};

type TodoEntity = Entity & { attributes: { listId?: string } };

function useTodoCountByList() {
  const todosResult = useEntities({
    entityType: 'todo',
    where: DELETED_CLAUSE,
  });
  const todos = (todosResult.entities ?? []) as TodoEntity[];
  const counts = new Map<string, number>();
  for (const t of todos) {
    const lid = t.attributes.listId ?? INBOX_LIST_ID;
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
    where: DELETED_CLAUSE,
    orderBy: [
      { attribute: 'order', direction: 'asc' as const },
      { attribute: 'createdAt', direction: 'asc' as const },
    ],
  });
  const lists = (listsResult.entities ?? []) as TodoListEntity[];
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
          name,
          order: lists.length,
          createdAt: new Date().toISOString(),
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
        attributes: { deleted: true },
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

  const data: { id: string; name: string; count: number }[] = [
    { id: INBOX_LIST_ID, name: 'Inbox', count: inboxCount },
    ...lists.map((l) => ({
      id: l.entityId,
      name: (l.attributes.name as string) ?? 'Untitled',
      count: todoCounts.get(l.entityId) ?? 0,
    })),
  ];

  return (
    <ThemedView style={theme.sx({ flex: 1, p: 4 })}>
      <ThemedView
        style={theme.sx({
          mb: 4,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        })}
      >
        <ThemedView>
          <ThemedText type="title">Todo Lists</ThemedText>
          <ThemedText type="subtitle">Group your todos by list</ThemedText>
        </ThemedView>
        <Pressable
          onPress={() => setDeleteDbModalVisible(true)}
          style={({ pressed }) => [
            theme.sx({ py: 2, px: 3, borderRadius: 8 }),
            pressed && theme.sx({ opacity: 0.7 }),
          ]}
        >
          <ThemedText
            style={[
              theme.sx({ fontSize: 14 }),
              { color: theme.colors.destructive },
            ]}
          >
            Clear data
          </ThemedText>
        </Pressable>
      </ThemedView>

      {adding ? (
        <ThemedView style={theme.sx({ flexDirection: 'row', gap: 2, mb: 3 })}>
          <TextInput
            style={theme.sx({
              flex: 1,
              borderWidth: 1,
              borderRadius: 8,
              px: 3,
              py: 2.5,
              fontSize: 16,
              background: 'paper',
              color: 'text',
              borderColor: 'border',
            })}
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
            <ThemedText type="defaultSemiBold">Add</ThemedText>
          </Pressable>
        </ThemedView>
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
          <ThemedText type="defaultSemiBold">+ New List</ThemedText>
        </Pressable>
      )}

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        style={theme.sx({ flex: 1 })}
        contentContainerStyle={theme.sx({ pb: 24 })}
        renderItem={({ item }) => (
          <ThemedView
            style={theme.sx({
              flexDirection: 'row',
              alignItems: 'center',
              py: 3.5,
              px: 3,
              borderRadius: 8,
              mb: 1,
            })}
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
              <ThemedText style={theme.sx({ fontSize: 17, fontWeight: '500' })}>
                {item.name}
              </ThemedText>
              <ThemedText style={theme.sx({ fontSize: 15, opacity: 0.6 })}>
                {item.count}
              </ThemedText>
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
                <ThemedText
                  style={[
                    theme.sx({ fontSize: 14 }),
                    { color: theme.colors.tint },
                  ]}
                >
                  Delete
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        )}
        ListEmptyComponent={
          <ThemedText
            style={theme.sx({ opacity: 0.7, fontStyle: 'italic', mt: 6 })}
          >
            No lists yet. Create one above or add todos to Inbox.
          </ThemedText>
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
    </ThemedView>
  );
}
