import { TodoListsOverview } from '@gamezilla/patch-db-app/todo';
import { useRouter } from 'expo-router';

export default function TodoListsScreen() {
  const router = useRouter();
  return (
    <TodoListsOverview onOpenList={(id) => router.push(`/todos/${id}`)} />
  );
}
