import {
  Box,
  EmptyState,
  FlatList,
  MutationModal,
  ScreenBaseHeader,
  useTheme,
  type ScreenBaseBreadcrumb,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';

import { INBOX_LIST_ID } from '../domain/todo-constants';
import { useTodoListIds } from '../query/use-todo-list-ids';
import { TodoListCreateBar } from './todo-list-create-bar';
import { TodoListRow } from './todo-list-row';

function ClearDbModal({
  visible,
  operation,
  onClose,
}: {
  visible: boolean;
  operation: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <MutationModal
      visible={visible}
      onClose={onClose}
      title={t`Clear All Data`}
      message={t`Are you sure you want to delete the local database? All todos and lists will be permanently removed. The app will reload.`}
      submitLabel={t`Clear`}
      variant="destructive"
      operation={operation}
      loadingLabel={t`Clearing local database…`}
      successTitle={t`Local database cleared`}
      errorTitle={t`Couldn't clear data`}
    />
  );
}

export type TodoListsOverviewProps = {
  onOpenList: (listId: string) => void;
  /**
   * Full breadcrumb trail for the screen header. When omitted, a single
   * "Todo Lists" crumb is rendered (used by standalone playgrounds).
   */
  breadcrumbs?: ScreenBaseBreadcrumb[];
  /** Wipe local SQLite (and reload on web). When omitted, the "Clear data" action is hidden. */
  onClearLocalDatabase?: () => Promise<void> | void;
};

type LinguiT = ReturnType<typeof useLingui>['t'];

function defaultBreadcrumbs(t: LinguiT): ScreenBaseBreadcrumb[] {
  return [{ name: t`Todo Lists` }];
}

export function TodoListsOverview({
  onOpenList,
  breadcrumbs,
  onClearLocalDatabase,
}: TodoListsOverviewProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const [deleteDbModalVisible, setDeleteDbModalVisible] = useState(false);
  const listIds = useTodoListIds();

  const rowIds = useMemo(() => [INBOX_LIST_ID, ...listIds], [listIds]);

  const deleteLocalDatabase = async () => {
    await onClearLocalDatabase?.();
  };

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenBaseHeader
        breadcrumbs={breadcrumbs ?? defaultBreadcrumbs(t)}
        actions={
          onClearLocalDatabase !== undefined
            ? [
                {
                  type: 'destructive',
                  label: t`Clear data`,
                  onPress: () => setDeleteDbModalVisible(true),
                  overflow: 'never',
                },
              ]
            : []
        }
      />
      <Box sx={{ flex: 1, p: 4 }}>
        <TodoListCreateBar />
        <FlatList
          data={rowIds}
          keyExtractor={(id) => id}
          style={theme.sx({ flex: 1 })}
          sx={{ pb: 24 }}
          renderItem={({ item: listId }) => (
            <TodoListRow listId={listId} onOpen={() => onOpenList(listId)} />
          )}
          ListEmptyComponent={
            <EmptyState
              variant="compact"
              title={t`No lists yet`}
              body={t`Create one above or add todos to Inbox.`}
            />
          }
        />
        <ClearDbModal
          visible={deleteDbModalVisible}
          operation={deleteLocalDatabase}
          onClose={() => setDeleteDbModalVisible(false)}
        />
      </Box>
    </Box>
  );
}
