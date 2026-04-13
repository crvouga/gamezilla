import { TodoListsOverview } from '@gamezilla/patch-db-app/todo';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';

export default function TodoListsScreen() {
  const router = useRouter();
  const navigation = useNavigation();

  const onBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
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
