import { Text } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import {
  INBOX_LIST_ID,
  TODO_LIST_ENTITY_TYPE,
  TodoListAttr,
} from '../domain/todo-constants';

/**
 * Resolved display name for a list row (inbox / untitled / stored name).
 * Shared by {@link TodoListRowNameText} and delete confirmation copy.
 */
export function useTodoListDisplayName(listId: string): string {
  const { t } = useLingui();
  const rawName = useQueryAttribute({
    entityType: TODO_LIST_ENTITY_TYPE,
    entityId: listId,
    attribute: TodoListAttr.name,
  });

  if (listId === INBOX_LIST_ID) return t`Inbox`;
  return rawName.length > 0 ? rawName : t`Untitled`;
}

export type TodoListRowNameTextProps = {
  listId: string;
  style?: StyleProp<TextStyle>;
};

/** List title for overview / detail header. */
export function TodoListRowNameText({
  listId,
  style,
}: TodoListRowNameTextProps): ReactNode {
  const label = useTodoListDisplayName(listId);
  return <Text style={style} label={label} />;
}
