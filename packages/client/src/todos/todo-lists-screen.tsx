import { usePatchDbLocalDataActions } from '@gamezilla/auth/client/patch-db-local-data-actions-context';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { TodoListsOverview } from '@gamezilla/patch-db-example/todo';
import { Trans } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function TodoListsScreen() {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const { clearLocalDatabaseAndReload } = usePatchDbLocalDataActions();

  return (
    <TodoListsOverview
      onOpenList={(id) => router.push(`/todos/${id}`)}
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Developer</Trans>, onPress: nav('/more/developer') },
        {
          name: <Trans>Todos</Trans>,
          subtitle: <Trans>Group your todos by list</Trans>,
        },
      ]}
      onClearLocalDatabase={() => void clearLocalDatabaseAndReload()}
    />
  );
}
