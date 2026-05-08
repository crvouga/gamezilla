import { Box, Pressable, Text, TextInput, useTheme } from '@gamezilla/lib/ui';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import { INBOX_LIST_ID, TODO_ENTITY_TYPE, TodoAttr } from '../domain/todo-constants';
import { useTodoCountForList } from '../query/use-todo-count-for-list';

export type TodoAddBarProps = {
  listId: string;
};

export function TodoAddBar({ listId }: TodoAddBarProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const db = usePatchDb();
  const [input, setInput] = useState('');
  const totalCount = useTodoCountForList(listId, 'all');

  const onAdd = async () => {
    const title = input.trim();
    if (!title) return;
    await db.write([
      {
        entityId: crypto.randomUUID(),
        entityType: TODO_ENTITY_TYPE,
        attributes: {
          ...TodoAttr.title(title),
          ...TodoAttr.completed(false),
          ...TodoAttr.order(totalCount),
          ...TodoAttr.createdAt(new Date().toISOString()),
          ...(listId !== INBOX_LIST_ID ? TodoAttr.listId(listId) : {}),
        },
      },
    ]);
    setInput('');
  };

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
        onSubmitEditing={() => void onAdd()}
        returnKeyType="done"
      />
      <Pressable
        onPress={() => void onAdd()}
        style={theme.sx({ justifyContent: 'center', px: 4 })}
      >
        <Text variant="bodyBold" label={<Trans>Add</Trans>} />
      </Pressable>
    </Box>
  );
}
