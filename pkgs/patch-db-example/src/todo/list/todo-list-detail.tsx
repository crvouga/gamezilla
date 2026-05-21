import {
  Box,
  KeyboardAvoidingView,
  Pressable,
  ScreenBaseHeader,
  Text,
  useTheme,
  type ScreenBaseBreadcrumb,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { TodoAddBar } from '../item/todo-add-bar';
import { TodoItemRow } from '../item/todo-item-row';
import type { TodoFilter } from '../query/todo-where-clauses';
import { useTodoIdsInList } from '../query/use-todo-ids-in-list';
import { TodoListRowNameText } from './todo-list-row-name-text';

function FilterTabs({
  filter,
  setFilter,
}: {
  filter: TodoFilter;
  setFilter: (f: TodoFilter) => void;
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

  const renderTab = (key: TodoFilter, label: string) => (
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
      {renderTab('all', t`All`)}
      {renderTab('active', t`Active`)}
      {renderTab('completed', t`Completed`)}
    </Box>
  );
}

function TodoListBody({
  listId,
  filter,
}: {
  listId: string;
  filter: TodoFilter;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const ids = useTodoIdsInList(listId, filter);

  if (ids.length === 0) {
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
      {ids.map((entityId) => (
        <TodoItemRow key={entityId} entityId={entityId} />
      ))}
    </>
  );
}

export type TodoListDetailProps = {
  listId: string;
  /**
   * Breadcrumb trail prepended before the dynamic list-name crumb.
   * Standalone playgrounds can omit this; the app passes the full hierarchy
   * (Spaces / Settings / Developer / Todos / ...).
   */
  parentBreadcrumbs?: ScreenBaseBreadcrumb[];
};

export function TodoListDetail({
  listId,
  parentBreadcrumbs,
}: TodoListDetailProps) {
  const [filter, setFilter] = useState<TodoFilter>('all');

  const breadcrumbs: ScreenBaseBreadcrumb[] = [
    ...(parentBreadcrumbs ?? []),
    { name: <TodoListRowNameText listId={listId} /> },
  ];

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader breadcrumbs={breadcrumbs} />
      <KeyboardAvoidingView sx={{ flex: 1, p: 4 }}>
        <FilterTabs filter={filter} setFilter={setFilter} />
        <TodoAddBar listId={listId} />
        <Box sx={{ flex: 1 }}>
          <TodoListBody listId={listId} filter={filter} />
        </Box>
      </KeyboardAvoidingView>
    </Box>
  );
}
