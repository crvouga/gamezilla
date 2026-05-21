import { Text } from '@gamezilla/ui';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useTodoCountForList } from '../query/use-todo-count-for-list';

export type TodoListRowCountTextProps = {
  listId: string;
  style?: StyleProp<TextStyle>;
};

export function TodoListRowCountText({
  listId,
  style,
}: TodoListRowCountTextProps): ReactNode {
  const count = useTodoCountForList(listId, 'all');
  return <Text style={style} label={String(count)} />;
}
