import { TodoListsOverview } from '@gamezilla/patch-db-app/todo';
import { useRouter } from 'expo-router';

export default function TodoListsScreen() {
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
    />
  );
}
