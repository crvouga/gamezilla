import {
  INBOX_LIST_ID,
  TodoListDetail,
} from '@gamezilla/patch-db-app/todo';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function TodoListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/todos');
  };

  const lid = listId ?? INBOX_LIST_ID;

  return <TodoListDetail listId={lid} onBack={onBack} />;
}
