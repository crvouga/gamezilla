import {
  Box,
  KeyboardAvoidingView,
  Pressable,
  ScreenBaseHeader,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/lib/ui';
import type {
  Entity,
  PatchDbQuery,
  PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import { usePatchDb, useQuery, useQueryOne } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { INBOX_LIST_ID } from './todo-constants';
import { TodoItem } from './todo-item';

const DELETED_CLAUSE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todo/deleted' },
    { type: '=', attribute: 'todo/deleted', value: false },
  ],
};

const ACTIVE_CLAUSE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todo/completed' },
    { type: '=', attribute: 'todo/completed', value: false },
  ],
};

type Filter = 'all' | 'active' | 'completed';

function buildListClause(listId: string): PatchDbQueryWhereClause {
  if (listId === INBOX_LIST_ID) {
    return {
      type: 'or',
      clauses: [
        { type: 'not_exists', attribute: 'todo/listId' },
        { type: '=', attribute: 'todo/listId', value: null },
        { type: '=', attribute: 'todo/listId', value: '' },
      ],
    };
  }
  return { type: '=', attribute: 'todo/listId', value: listId };
}

function buildWhereForFilter(
  filter: Filter,
  listClause: PatchDbQueryWhereClause
): PatchDbQueryWhereClause {
  if (filter === 'all') {
    return { type: 'and', clauses: [DELETED_CLAUSE, listClause] };
  }
  if (filter === 'active') {
    return {
      type: 'and',
      clauses: [DELETED_CLAUSE, listClause, ACTIVE_CLAUSE],
    };
  }
  return {
    type: 'and',
    clauses: [
      DELETED_CLAUSE,
      listClause,
      { type: '=', attribute: 'todo/completed', value: true },
    ],
  };
}

function buildTodoQuery(listId: string, filter: Filter): PatchDbQuery {
  const listClause = buildListClause(listId);
  const where = buildWhereForFilter(filter, listClause);
  return {
    entityType: 'todo',
    where,
    orderBy: [
      { attribute: 'todo/order', direction: 'asc' },
      { attribute: 'todo/createdAt', direction: 'asc' },
    ],
  };
}

function useListName(listId: string): string {
  const { t } = useLingui();
  const listEntity = useQueryOne({
    entityType: 'todoList',

    entityId: listId === INBOX_LIST_ID ? '__inbox_placeholder__' : listId,
  });
  if (listId === INBOX_LIST_ID) return t`Inbox`;
  const nameRaw = listEntity?.attributes['todoList/name'];
  return typeof nameRaw === 'string' ? nameRaw : t`List`;
}

function FilterTabs({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const filterButtonStyle = (active: boolean) =>
    theme.sx({
      py: 1.5,
      px: 3,
      borderRadius: 8,
      ...(active && { backgroundColor: theme.colors.tintMuted }),
    });

  const renderTab = (key: Filter, label: string) => (
    <Pressable
      onPress={() => setFilter(key)}
      style={filterButtonStyle(filter === key)}
    >
      <Text
        style={filter === key ? theme.sx({ fontWeight: '600' }) : undefined}
        label={label}
      />
    </Pressable>
  );

  return (
    <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
      {}
      {renderTab('all', t`All`)}
      {renderTab('active', t`Active`)}
      {renderTab('completed', t`Completed`)}
      {}
    </Box>
  );
}

function AddTodoBar({
  input,
  setInput,
  onAdd,
}: {
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, mb: 4 }}>
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
        placeholder={t`Add a todo...`}
        placeholderTextColor={theme.colors.icon}
        value={input}
        onChangeText={setInput}
        onSubmitEditing={onAdd}
        returnKeyType="done"
      />
      <Pressable
        onPress={onAdd}
        style={theme.sx({ justifyContent: 'center', px: 4 })}
      >
        <Text variant="bodyBold" label={<Trans>Add</Trans>} />
      </Pressable>
    </Box>
  );
}

function TodoItems({
  todos,
  filter,
  onToggle,
  onDelete,
}: {
  todos: Entity[];
  filter: Filter;
  onToggle: (e: Entity) => void;
  onDelete: (e: Entity) => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  if (todos.length === 0) {
    return (
      <Text
        style={theme.sx({ opacity: 0.7, fontStyle: 'italic' })}
        label={
          filter === 'all'
            ? t`No todos yet. Add one above!`
            : filter === 'active'
              ? t`No active todos.`
              : t`No completed todos.`
        }
      />
    );
  }
  return (
    <>
      {todos.map((entity) => (
        <TodoItem
          key={entity.entityId}
          entityId={entity.entityId}
          onToggle={() => onToggle(entity)}
          onDelete={() => onDelete(entity)}
        />
      ))}
    </>
  );
}

export type TodoListDetailProps = {
  listId: string;
  onBack?: () => void;
};

function buildTodoCreatePayload(
  listId: string,
  title: string,
  totalCount: number
) {
  return {
    entityId: crypto.randomUUID(),
    entityType: 'todo',
    attributes: {
      'todo/title': title,
      'todo/completed': false,
      'todo/order': totalCount,
      'todo/createdAt': new Date().toISOString(),
      ...(listId !== INBOX_LIST_ID && { 'todo/listId': listId }),
    },
  };
}

function buildTodoTogglePayload(entity: Entity) {
  return {
    entityId: entity.entityId,
    entityType: 'todo',
    attributes: {
      'todo/completed': !Boolean(entity.attributes['todo/completed']),
    },
  };
}

function buildTodoDeletePayload(entity: Entity) {
  return {
    entityId: entity.entityId,
    entityType: 'todo',
    attributes: { 'todo/deleted': true },
  };
}

export function TodoListDetail({ listId, onBack }: TodoListDetailProps) {
  const { t } = useLingui();
  const db = usePatchDb();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const allResult = useQuery(buildTodoQuery(listId, 'all'));
  const filterResult = useQuery(buildTodoQuery(listId, filter));
  const todos = filterResult.entities;
  const totalCount = allResult.total;

  const listName = useListName(listId);

  const addTodo = async () => {
    const title = input.trim();
    if (!title) return;
    await db.write([buildTodoCreatePayload(listId, title, totalCount)]);
    setInput('');
  };

  const toggleTodo = async (entity: Entity) => {
    await db.write([buildTodoTogglePayload(entity)]);
  };

  const deleteTodo = async (entity: Entity) => {
    await db.write([buildTodoDeletePayload(entity)]);
  };

  const breadcrumbs =
    onBack !== undefined
      ? [{ name: t`Todo Lists`, onPress: onBack }, { name: listName }]
      : [{ name: listName }];

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={breadcrumbs} />
      <KeyboardAvoidingView sx={{ flex: 1, p: 4 }}>
        <FilterTabs filter={filter} setFilter={setFilter} />
        <AddTodoBar input={input} setInput={setInput} onAdd={addTodo} />
        <Box sx={{ flex: 1 }}>
          <TodoItems
            todos={todos}
            filter={filter}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
        </Box>
      </KeyboardAvoidingView>
    </Box>
  );
}
