import {
  INBOX_LIST_ID,
  TodoListDetail,
} from '@gamezilla/patch-db-app/todo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';

export default function TodoListDetailScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace('/todos');
  };

  const lid = listId ?? INBOX_LIST_ID;

  return <TodoListDetail listId={lid} onBack={onBack} />;
}
