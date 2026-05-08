import { Text, useTheme } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { TODO_ENTITY_TYPE, TodoAttr } from '../domain/todo-constants';

export type TodoItemTitleTextProps = {
  entityId: string;
};

export function TodoItemTitleText({
  entityId,
}: TodoItemTitleTextProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const title = useQueryAttribute({
    entityType: TODO_ENTITY_TYPE,
    entityId,
    attribute: TodoAttr.title,
  });
  const completed = useQueryAttribute({
    entityType: TODO_ENTITY_TYPE,
    entityId,
    attribute: TodoAttr.completed,
  });
  return (
    <Text
      style={[
        theme.sx({ flex: 1, fontSize: 16 }),
        completed &&
          theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
      ]}
      numberOfLines={1}
      label={title || t`(untitled)`}
    />
  );
}
