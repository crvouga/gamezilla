import type {
  Entity,
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import {
  useEntities,
  useEntity,
  usePatchesDb,
} from '@gamezilla/patch-db/react';
import {
  Box,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/shared/ui';
import { useState } from 'react';

import { INBOX_LIST_ID } from './todo-constants';
import { TodoItem } from './todo-item';
import { TodoScreenHeader } from './todo-screen-header';

const DELETED_CLAUSE: PatchesDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todo/deleted' },
    { type: '=', attribute: 'todo/deleted', value: false },
  ],
};

const ACTIVE_CLAUSE: PatchesDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todo/completed' },
    { type: '=', attribute: 'todo/completed', value: false },
  ],
};

function buildTodoQuery(listId: string, filter: Filter): PatchesDbQuery {
  const listClause: PatchesDbQueryWhereClause =
    listId === INBOX_LIST_ID
      ? {
          type: 'or',
          clauses: [
            { type: 'not_exists', attribute: 'todo/listId' },
            { type: '=', attribute: 'todo/listId', value: null },
            { type: '=', attribute: 'todo/listId', value: '' },
          ],
        }
      : { type: '=', attribute: 'todo/listId', value: listId };

  const where: PatchesDbQueryWhereClause =
    filter === 'all'
      ? { type: 'and', clauses: [DELETED_CLAUSE, listClause] }
      : filter === 'active'
        ? {
            type: 'and',
            clauses: [DELETED_CLAUSE, listClause, ACTIVE_CLAUSE],
          }
        : {
            type: 'and',
            clauses: [
              DELETED_CLAUSE,
              listClause,
              { type: '=', attribute: 'todo/completed', value: true },
            ],
          };

  return {
    entityType: 'todo',
    where,
    orderBy: [
      { attribute: 'todo/order', direction: 'asc' },
      { attribute: 'todo/createdAt', direction: 'asc' },
    ],
  };
}

type Filter = 'all' | 'active' | 'completed';

export type TodoListDetailProps = {
  listId: string;
  onBack?: () => void;
};

export function TodoListDetail({ listId, onBack }: TodoListDetailProps) {
  const theme = useTheme();
  const db = usePatchesDb();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const lid = listId;

  const allResult = useEntities(buildTodoQuery(lid, 'all'));
  const filterResult = useEntities(buildTodoQuery(lid, filter));
  const todos = filterResult.entities;
  const totalCount = allResult.total;

  const listEntity = useEntity({
    entityType: 'todoList',
    entityId: lid === INBOX_LIST_ID ? '__inbox_placeholder__' : lid,
  });
  const listName =
    lid === INBOX_LIST_ID
      ? 'Inbox'
      : (() => {
          const nameRaw = listEntity?.attributes['todoList/name'];
          return typeof nameRaw === 'string' ? nameRaw : 'List';
        })();

  const filterButtonStyle = (active: boolean) =>
    theme.sx({
      py: 1.5,
      px: 3,
      borderRadius: 8,
      ...(active && { backgroundColor: theme.colors.tintMuted }),
    });

  const addTodo = async () => {
    const title = input.trim();
    if (!title) return;
    await db.write([
      {
        entityId: crypto.randomUUID(),
        entityType: 'todo',
        attributes: {
          'todo/title': title,
          'todo/completed': false,
          'todo/order': totalCount,
          'todo/createdAt': new Date().toISOString(),
          ...(lid !== INBOX_LIST_ID && { 'todo/listId': lid }),
        },
      },
    ]);
    setInput('');
  };

  const toggleTodo = async (entity: Entity) => {
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: {
          'todo/completed': !Boolean(entity.attributes['todo/completed']),
        },
      },
    ]);
  };

  const deleteTodo = async (entity: Entity) => {
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: { 'todo/deleted': true },
      },
    ]);
  };

  return (
    <Box sx={{ flex: 1 }}>
      <TodoScreenHeader
        title={listName}
        {...(onBack !== undefined ? { onBack } : {})}
      />
      <KeyboardAvoidingView sx={{ flex: 1, p: 4 }}>
        <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
          <Pressable
            onPressIn={() => setFilter('all')}
            style={filterButtonStyle(filter === 'all')}
          >
            <Text
              style={
                filter === 'all' ? theme.sx({ fontWeight: '600' }) : undefined
              }
              label="All"
            />
          </Pressable>
          <Pressable
            onPressIn={() => setFilter('active')}
            style={filterButtonStyle(filter === 'active')}
          >
            <Text
              style={
                filter === 'active'
                  ? theme.sx({ fontWeight: '600' })
                  : undefined
              }
              label="Active"
            />
          </Pressable>
          <Pressable
            onPressIn={() => setFilter('completed')}
            style={filterButtonStyle(filter === 'completed')}
          >
            <Text
              style={
                filter === 'completed'
                  ? theme.sx({ fontWeight: '600' })
                  : undefined
              }
              label="Completed"
            />
          </Pressable>
        </Box>
        <Box sx={{ flexDirection: 'row', gap: 2, mb: 4 }}>
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
            placeholder="Add a todo..."
            placeholderTextColor={theme.colors.icon}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={addTodo}
            returnKeyType="done"
          />
          <Pressable
            onPressIn={addTodo}
            style={theme.sx({ justifyContent: 'center', px: 4 })}
          >
            <Text variant="bodyBold" label="Add" />
          </Pressable>
        </Box>
        <Box sx={{ flex: 1 }}>
          {todos.length === 0 ? (
            <Text
              style={theme.sx({ opacity: 0.7, fontStyle: 'italic' })}
              label={
                filter === 'all'
                  ? 'No todos yet. Add one above!'
                  : `No ${filter} todos.`
              }
            />
          ) : (
            todos.map((entity) => (
              <TodoItem
                key={entity.entityId}
                entityId={entity.entityId}
                onToggle={() => toggleTodo(entity)}
                onDelete={() => deleteTodo(entity)}
              />
            ))
          )}
        </Box>
      </KeyboardAvoidingView>
    </Box>
  );
}
