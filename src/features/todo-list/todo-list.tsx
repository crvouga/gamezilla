import type { Entity } from '@/@shared/patch-db/interface';
import { useEntities, useEntity, usePatchesDb } from '@/@shared/patch-db/react';
import { useTheme } from '@/@shared/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';

const DELETED_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'deleted' },
    { type: '=' as const, attribute: 'deleted', value: false },
  ],
};

const ACTIVE_CLAUSE = {
  type: 'or' as const,
  clauses: [
    { type: 'not_exists' as const, attribute: 'completed' },
    { type: '=' as const, attribute: 'completed', value: false },
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
              { type: '=' as const, attribute: 'completed', value: true },
            ],
          };
  return {
    entityType: 'todo' as const,
    where,
    orderBy: [
      { attribute: 'order', direction: 'asc' as const },
      { attribute: 'createdAt', direction: 'asc' as const },
    ],
  };
}

type TodoEntity = Entity & {
  attributes: { title?: string; completed?: boolean; order?: number };
};

function TodoItem({
  entityId,
  onToggle,
  onDelete,
}: {
  entityId: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const entity = useEntity({ entityId, entityType: 'todo' });
  const completed = entity?.attributes.completed === true;
  const title = (entity?.attributes.title as string) ?? '';

  return (
    <ThemedView
      style={theme.sx({
        flexDirection: 'row',
        alignItems: 'center',
        py: 3,
        px: 0,
        gap: 3,
        borderBottomWidth: 'hairline',
        borderColor: 'border',
      })}
    >
      <Pressable
        onPress={onToggle}
        style={theme.sx({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        })}
      >
        <ThemedText
          style={[
            theme.sx({ fontSize: 20 }),
            completed &&
              theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
          ]}
        >
          {completed ? '✓' : '○'}
        </ThemedText>
        <ThemedText
          style={[
            theme.sx({ flex: 1, fontSize: 16 }),
            completed &&
              theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
          ]}
          numberOfLines={1}
        >
          {title || '(untitled)'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={onDelete} style={theme.sx({ p: 1 })} hitSlop={8}>
        <ThemedText
          style={[theme.sx({ fontSize: 14 }), { color: theme.colors.tint }]}
        >
          Delete
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

type Filter = 'all' | 'active' | 'completed';

export function TodoList() {
  const theme = useTheme();
  const db = usePatchesDb();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const allResult = useEntities(buildTodoQuery('all'));
  const filterResult = useEntities(buildTodoQuery(filter));
  const todos = filterResult.data as TodoEntity[];
  const totalCount = allResult.total;

  const addTodo = async () => {
    const title = input.trim();
    if (!title) return;
    const entityId = crypto.randomUUID();
    await db.write([
      {
        entityId,
        entityType: 'todo',
        attributes: {
          title,
          completed: false,
          order: totalCount,
          createdAt: new Date().toISOString(),
        },
      },
    ]);
    setInput('');
  };

  const toggleTodo = async (entity: TodoEntity) => {
    const completed = entity.attributes.completed === true;
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: { completed: !completed },
      },
    ]);
  };

  const deleteTodo = async (entity: TodoEntity) => {
    await db.write([
      {
        entityId: entity.entityId,
        entityType: 'todo',
        attributes: { deleted: true },
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={theme.sx({ flex: 1, p: 4 })}
    >
      <ThemedView style={theme.sx({ mb: 4 })}>
        <ThemedText type="title">Todos</ThemedText>
        <ThemedText type="subtitle">Powered by patch-db</ThemedText>
      </ThemedView>
      <ThemedView style={theme.sx({ flexDirection: 'row', gap: 2, mb: 3 })}>
        <Pressable
          onPress={() => setFilter('all')}
          style={filterButtonStyle(filter === 'all')}
        >
          <ThemedText
            style={
              filter === 'all' ? theme.sx({ fontWeight: '600' }) : undefined
            }
          >
            All
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter('active')}
          style={filterButtonStyle(filter === 'active')}
        >
          <ThemedText
            style={
              filter === 'active' ? theme.sx({ fontWeight: '600' }) : undefined
            }
          >
            Active
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setFilter('completed')}
          style={filterButtonStyle(filter === 'completed')}
        >
          <ThemedText
            style={
              filter === 'completed'
                ? theme.sx({ fontWeight: '600' })
                : undefined
            }
          >
            Completed
          </ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedView style={theme.sx({ flexDirection: 'row', gap: 2, mb: 4 })}>
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
          <ThemedText type="defaultSemiBold">Add</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedView style={theme.sx({ flex: 1 })}>
        {todos.length === 0 ? (
          <ThemedText style={theme.sx({ opacity: 0.7, fontStyle: 'italic' })}>
            {filter === 'all'
              ? 'No todos yet. Add one above!'
              : `No ${filter} todos.`}
          </ThemedText>
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
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
