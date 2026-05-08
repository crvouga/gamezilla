import { Box, Pressable, Text, TextInput, useTheme } from '@gamezilla/lib/ui';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import { TodoListAttr } from '../domain/todo-constants';
import { useTodoListCount } from '../query/use-todo-list-count';

function AddListInput({
  input,
  setInput,
  onSubmit,
  onBlurEmpty,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
  onBlurEmpty: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, mb: 3 }}>
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
        placeholder={t`List name...`}
        placeholderTextColor={theme.colors.icon}
        value={input}
        onChangeText={setInput}
        onSubmitEditing={onSubmit}
        onBlur={() => {
          if (!input.trim()) onBlurEmpty();
        }}
        autoFocus
      />
      <Pressable
        onPress={onSubmit}
        style={theme.sx({ justifyContent: 'center', px: 4 })}
      >
        <Text variant="bodyBold" label={<Trans>Add</Trans>} />
      </Pressable>
    </Box>
  );
}

function NewListButton({ onPress }: { onPress: () => void }) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        theme.sx({
          py: 3,
          px: 4,
          borderRadius: 8,
          mb: 4,
          alignItems: 'center',
        }),
        { backgroundColor: theme.colors.tintMuted },
      ]}
    >
      <Text variant="bodyBold" label={t`+ New List`} />
    </Pressable>
  );
}

/** Create a new todo list; owns collapsed / expanded UI and write. */
export function TodoListCreateBar(): ReactNode {
  const db = usePatchDb();
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const listCount = useTodoListCount();

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    await db.write([
      {
        entityId: crypto.randomUUID(),
        entityType: 'todoList',
        attributes: {
          ...TodoListAttr.name(trimmed),
          ...TodoListAttr.order(listCount),
          ...TodoListAttr.createdAt(new Date().toISOString()),
        },
      },
    ]);
    setInput('');
    setAdding(false);
  };

  return adding ? (
    <AddListInput
      input={input}
      setInput={setInput}
      onSubmit={() => void handleAdd()}
      onBlurEmpty={() => setAdding(false)}
    />
  ) : (
    <NewListButton onPress={() => setAdding(true)} />
  );
}
