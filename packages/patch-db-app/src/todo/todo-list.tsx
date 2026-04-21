import { Entity } from '@gamezilla/patch-db/interface';
import { useEntities, usePatchesDb } from '@gamezilla/patch-db/react';
import {
  Box,
  KeyboardAvoidingView,
  Pressable,
  ScreenBaseHeader,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/shared/ui';
import { useState } from 'react';

import { TodoItem } from './todo-item';

const DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'todo/deleted' },
    { type: '=' as const, attribute: 'todo/deleted', value: false },
  ],
};

const ACTIVE_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'todo/completed' },
    { type: '=' as const, attribute: 'todo/completed', value: false },
  ],
};

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
                attribute: 'todo/completed',
                value: true,
              },
            ],
          };
  return {
    entityType: 'todo' as const,
    where,
    orderBy: [
      { attribute: 'todo/order', direction: 'asc' as const },
      { attribute: 'todo/createdAt', direction: 'asc' as const },
    ],
  };
}

type Filter = 'all' | 'active' | 'completed';

export function TodoList() {
  const theme = useTheme();
  const db = usePatchesDb();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const allResult = useEntities(buildTodoQuery('all'));
  const filterResult = useEntities(buildTodoQuery(filter));
  const todos = filterResult.entities;
  const totalCount = allResult.total;

  const addTodo = async () => {
    const title = input.trim();
    if (!title) return;
    const entityId = globalThis.crypto.randomUUID();
    await db.write([
      {
        entityId,
        entityType: 'todo',
        attributes: {
          'todo/title': title,
          'todo/completed': false,
          'todo/order': totalCount,
          'todo/createdAt': new Date().toISOString(),
        },
      },
    ]);
    setInput('');
  };

  const toggleTodo = async (entity: Entity) => {
    const completed = entity.attributes['todo/completed'] === true;
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: { 'todo/completed': !completed },
      },
    ]);
  };

  const deleteTodo = async (entity: Entity) => {
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: {
          'todo/deleted': true,
        },
      },
    ]);
  };

  const filterButtonStyle = (active: boolean) =>
    theme.sx({
      py: 1.5,
      px: 3,
      borderRadius: 8,
      ...(active && { backgroundColor: theme.colors.tintMuted }),
    });

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={[{ name: 'Todos' }]} />
      <KeyboardAvoidingView sx={{ flex: 1, p: 4 }}>
        <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
          <Pressable
            onPress={() => setFilter('all')}
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
            onPress={() => setFilter('active')}
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
            onPress={() => setFilter('completed')}
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
              background: 'surface',
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
            onPress={addTodo}
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
