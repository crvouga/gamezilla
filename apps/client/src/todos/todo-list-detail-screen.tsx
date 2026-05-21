import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { INBOX_LIST_ID, TodoListDetail } from '@pkgs/patch-db-example/todo';
import { Trans } from '@lingui/react/macro';
import { useLocalSearchParams } from 'expo-router';

export function TodoListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const nav = useBreadcrumbNav();

  const lid = listId ?? INBOX_LIST_ID;

  return (
    <TodoListDetail
      listId={lid}
      parentBreadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        { name: <Trans>Todos</Trans>, onPress: nav('/todos') },
      ]}
    />
  );
}
