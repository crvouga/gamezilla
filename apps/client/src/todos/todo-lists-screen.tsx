import { usePatchDbLocalDataActions } from '@libs/auth/client/patch-db-local-data-actions-context';
import { useBreadcrumbNav } from '@apps/client/ui/use-breadcrumb-nav';
import { TodoListsOverview } from '@pkgs/patch-db-widgets/todo';
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
        { name: <Trans>Todos</Trans> },
      ]}
      onClearLocalDatabase={() => void clearLocalDatabaseAndReload()}
    />
  );
}
