import {
  Box,
  KeyboardAvoidingView,
  Pressable,
  ScreenBaseHeader,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/lib/ui';
import { mergePlain } from '@gamezilla/lib/merge-plain';
import type { Entity } from '@gamezilla/patch-db/interface';
import { usePatchDb, useQuery } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { TodoItem } from './todo-item';
import { TodoAttr } from './todo-constants';

const DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: TodoAttr.deleted.key },
    { type: '=' as const, attribute: TodoAttr.deleted.key, value: false },
  ],
};

const ACTIVE_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: TodoAttr.completed.key },
    { type: '=' as const, attribute: TodoAttr.completed.key, value: false },
  ],
};

type Filter = 'all' | 'active' | 'completed';

function buildTodoQuery(filter: Filter) {
  const where =
    filter === 'all'
      ? DELETED_CLAUSE
      : filter === 'active'
        ? { type: 'and' as const, clauses: [DELETED_CLAUSE, ACTIVE_CLAUSE] }
        : {
            type: 'and' as const,
            clauses: [
              DELETED_CLAUSE,
              {
                type: '=' as const,
                attribute: TodoAttr.completed.key,
                value: true,
              },
            ],
          };
  return {
    entityType: 'todo' as const,
    where,
    orderBy: [
      { attribute: TodoAttr.order.key, direction: 'asc' as const },
      { attribute: TodoAttr.createdAt.key, direction: 'asc' as const },
    ],
  };
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

function buildTodoCreatePayload(title: string, totalCount: number) {
  return {
    entityId: globalThis.crypto.randomUUID(),
    entityType: 'todo',
    attributes: mergePlain(
      TodoAttr.title(title),
      TodoAttr.completed(false),
      TodoAttr.order(totalCount),
      TodoAttr.createdAt(new Date().toISOString())
    ),
  };
}

function buildTodoTogglePayload(entity: Entity) {
  const completed = TodoAttr.completed.from(entity.attributes);
  return {
    entityId: entity.entityId,
    entityType: 'todo',
    attributes: TodoAttr.completed(!completed),
  };
}

function buildTodoDeletePayload(entity: Entity) {
  return {
    entityId: entity.entityId,
    entityType: 'todo',
    attributes: TodoAttr.deleted(true),
  };
}

export function TodoList() {
  const { t } = useLingui();
  const db = usePatchDb();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const allResult = useQuery(buildTodoQuery('all'));
  const filterResult = useQuery(buildTodoQuery(filter));
  const todos = filterResult.entities;
  const totalCount = allResult.total;

  const addTodo = async () => {
    const title = input.trim();
    if (!title) return;
    await db.write([buildTodoCreatePayload(title, totalCount)]);
    setInput('');
  };

  const toggleTodo = async (entity: Entity) => {
    await db.write([buildTodoTogglePayload(entity)]);
  };

  const deleteTodo = async (entity: Entity) => {
    await db.write([buildTodoDeletePayload(entity)]);
  };

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={[{ name: t`Todos` }]} />
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
