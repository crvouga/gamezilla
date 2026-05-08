import {
  Box,
  ConfirmationModal,
  FlatList,
  Pressable,
  ScreenBaseHeader,
  Text,
  TextInput,
  useTheme,
  type ScreenBaseBreadcrumb,
} from '@gamezilla/lib/ui';
import { mergePlain } from '@gamezilla/lib/merge-plain';
import { usePatchDb, useQuery } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { INBOX_LIST_ID, TodoAttr, TodoListAttr } from './todo-constants';

const TODO_LIST_DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: TodoListAttr.deleted.key },
    { type: '=' as const, attribute: TodoListAttr.deleted.key, value: false },
  ],
};

const TODO_DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: TodoAttr.deleted.key },
    { type: '=' as const, attribute: TodoAttr.deleted.key, value: false },
  ],
};

type ListRow = { id: string; name: string; count: number };

function useTodoCountByList() {
  const todosResult = useQuery({
    entityType: 'todo',
    where: TODO_DELETED_CLAUSE,
  });
  const counts = new Map<unknown, number>();
  for (const t of todosResult.entities) {
    const lid = TodoAttr.listId.from(t.attributes) ?? INBOX_LIST_ID;
    counts.set(lid, (counts.get(lid) ?? 0) + 1);
  }
  return counts;
}

function AddListInput({
  input,
  setInput,
  onSubmit,
  onBlurEmpty,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  onBlurEmpty: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
      <TextInput
        sx={{
          flex: 1,
          borderWidth: 1,
          borderRadius: 8,
          px: 3,
          py: 2.5,
          fontSize: 16,
          background: 'surface',
          color: 'text',
          borderColor: 'border',
        }}
        placeholder={t`List name...`}
        placeholderTextColor={theme.colors.icon}
        value={input}
        onChangeText={setInput}
        onSubmitEditing={onSubmit}
        onBlur={() => {
          if (!input.trim()) onBlurEmpty();
        }}
        autoFocus
      />
      <Pressable
        onPress={onSubmit}
        style={theme.sx({ justifyContent: 'center', px: 4 })}
      >
        <Text variant="bodyBold" label={<Trans>Add</Trans>} />
      </Pressable>
    </Box>
  );
}

function NewListButton({ onPress }: { onPress: () => void }) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
      <Text variant="bodyBold" label={t`+ New List`} />
    </Pressable>
  );
}

function ListRowItem({
  item,
  onOpen,
  onDelete,
}: {
  item: ListRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
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
        onPress={onOpen}
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
        <Text
          style={theme.sx({ fontSize: 17, fontWeight: '500' })}
          label={item.name}
        />
        <Text
          style={theme.sx({ fontSize: 15, opacity: 0.6 })}
          label={String(item.count)}
        />
      </Pressable>
      {item.id !== INBOX_LIST_ID && (
        <Pressable
          onPress={onDelete}
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
      )}
    </Box>
  );
}

function getListName(attrs: Record<string, unknown>, fallback: string): string {
  const nameRaw = TodoListAttr.name.from(attrs);
  return nameRaw.length > 0 ? nameRaw : fallback;
}

type Db = ReturnType<typeof usePatchDb>;

function useTodoListMutations(db: Db) {
  const addList = async (name: string, order: number) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const entityId = crypto.randomUUID();
    await db.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: mergePlain(
          TodoListAttr.name(trimmed),
          TodoListAttr.order(order),
          TodoListAttr.createdAt(new Date().toISOString())
        ),
      },
    ]);
    return true;
  };

  const deleteList = async (listId: string) => {
    await db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: TodoListAttr.deleted(true),
      },
    ]);
  };

  return { addList, deleteList };
}

function ListRowsList({
  rows,
  onOpenList,
  onDeleteRequest,
}: {
  rows: ListRow[];
  onOpenList: (id: string) => void;
  onDeleteRequest: (item: ListRow) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      style={theme.sx({ flex: 1 })}
      sx={{ pb: 24 }}
      renderItem={({ item }) => (
        <ListRowItem
          item={item}
          onOpen={() => onOpenList(item.id)}
          onDelete={() => onDeleteRequest(item)}
        />
      )}
      ListEmptyComponent={
        <Text
          style={theme.sx({ opacity: 0.7, fontStyle: 'italic', mt: 6 })}
          label={t`No lists yet. Create one above or add todos to Inbox.`}
        />
      }
    />
  );
}

function DeleteListModal({
  target,
  onConfirm,
  onCancel,
}: {
  target: { id: string; name: string } | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const targetName = target?.name ?? '';
  return (
    <ConfirmationModal
      visible={!!target}
      title={t`Delete List`}
      message={
        target
          ? t`Are you sure you want to delete "${targetName}"? This cannot be undone.`
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

function ClearDbModal({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  return (
    <ConfirmationModal
      visible={visible}
      title={t`Clear All Data`}
      message={t`Are you sure you want to delete the local database? All todos and lists will be permanently removed. The app will reload.`}
      confirmLabel={t`Clear`}
      cancelLabel={t`Cancel`}
      variant="destructive"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export type TodoListsOverviewProps = {
  onOpenList: (listId: string) => void;
  /**
   * Full breadcrumb trail for the screen header. When omitted, a single
   * "Todo Lists" crumb is rendered (used by standalone playgrounds).
   */
  breadcrumbs?: ScreenBaseBreadcrumb[];
  /** Wipe local SQLite (and reload on web). When omitted, the "Clear data" action is hidden. */
  onClearLocalDatabase?: () => Promise<void> | void;
};

type LinguiT = ReturnType<typeof useLingui>['t'];

function defaultBreadcrumbs(t: LinguiT): ScreenBaseBreadcrumb[] {
  return [
    {
      name: t`Todo Lists`,
      subtitle: t`Group your todos by list`,
    },
  ];
}

function buildListRows(
  lists: ReturnType<typeof useQuery>['entities'],
  todoCounts: Map<unknown, number>,
  inboxName: string,
  untitledName: string
): ListRow[] {
  const inboxCount = todoCounts.get(INBOX_LIST_ID) ?? 0;
  return [
    { id: INBOX_LIST_ID, name: inboxName, count: inboxCount },
    ...lists.map((l) => ({
      id: l.entityId,
      name: getListName(l.attributes, untitledName),
      count: todoCounts.get(l.entityId) ?? 0,
    })),
  ];
}

function useTodoListsState(onClearLocalDatabase?: () => Promise<void> | void) {
  const db = usePatchDb();
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteDbModalVisible, setDeleteDbModalVisible] = useState(false);

  const listsResult = useQuery({
    entityType: 'todoList',
    where: TODO_LIST_DELETED_CLAUSE,
    orderBy: [
      { attribute: TodoListAttr.order.key, direction: 'asc' },
      { attribute: TodoListAttr.createdAt.key, direction: 'asc' },
      { attribute: TodoListAttr.id.key, direction: 'asc' },
    ],
  });
  const lists = listsResult.entities ?? [];
  const todoCounts = useTodoCountByList();
  const { addList, deleteList } = useTodoListMutations(db);

  const handleAdd = async () => {
    const ok = await addList(input, lists.length);
    if (!ok) {
      setAdding(false);
      return;
    }
    setInput('');
    setAdding(false);
  };

  const deleteLocalDatabase = async () => {
    setDeleteDbModalVisible(false);
    await onClearLocalDatabase?.();
  };

  return {
    input,
    setInput,
    adding,
    setAdding,
    deleteTarget,
    setDeleteTarget,
    deleteDbModalVisible,
    setDeleteDbModalVisible,
    lists,
    todoCounts,
    deleteList,
    handleAdd,
    deleteLocalDatabase,
  };
}

export function TodoListsOverview({
  onOpenList,
  breadcrumbs,
  onClearLocalDatabase,
}: TodoListsOverviewProps) {
  const { t } = useLingui();
  const s = useTodoListsState(onClearLocalDatabase);
  const listRows = buildListRows(s.lists, s.todoCounts, t`Inbox`, t`Untitled`);

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs ?? defaultBreadcrumbs(t)}
        actions={
          onClearLocalDatabase !== undefined
            ? [
                {
                  type: 'destructive',
                  label: t`Clear data`,
                  onPress: () => s.setDeleteDbModalVisible(true),
                  overflow: 'never',
                },
              ]
            : []
        }
      />
      <Box sx={{ flex: 1, p: 4 }}>
        {s.adding ? (
          <AddListInput
            input={s.input}
            setInput={s.setInput}
            onSubmit={s.handleAdd}
            onBlurEmpty={() => s.setAdding(false)}
          />
        ) : (
          <NewListButton onPress={() => s.setAdding(true)} />
        )}

        <ListRowsList
          rows={listRows}
          onOpenList={onOpenList}
          onDeleteRequest={s.setDeleteTarget}
        />
        <DeleteListModal
          target={s.deleteTarget}
          onConfirm={() => {
            if (s.deleteTarget) {
              void s.deleteList(s.deleteTarget.id);
              s.setDeleteTarget(null);
            }
          }}
          onCancel={() => s.setDeleteTarget(null)}
        />
        <ClearDbModal
          visible={s.deleteDbModalVisible}
          onConfirm={s.deleteLocalDatabase}
          onCancel={() => s.setDeleteDbModalVisible(false)}
        />
      </Box>
    </Box>
  );
}
