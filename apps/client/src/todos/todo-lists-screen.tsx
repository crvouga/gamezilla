import { clearLocalDatabaseAndReload } from '@gamezilla/client/ui/patch-bootstrap';
import { TodoListsOverview } from '@gamezilla/patch-db-example/todo';
import { useRouter } from 'expo-router';

export function TodoListsScreen() {
  const router = useRouter();

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/more/developer');
  };

  return (
    <TodoListsOverview
      onOpenList={(id) => router.push(`/todos/${id}`)}
      onBack={onBack}
      onClearLocalDatabase={() => clearLocalDatabaseAndReload('main')}
    />
  );
}
