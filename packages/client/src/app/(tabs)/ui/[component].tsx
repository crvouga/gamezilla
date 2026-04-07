import { ExplorerDetail } from '@gamezilla/shared/ui/explorer';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

export default function UIExplorerDetail() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const navigation = useNavigation();

  useEffect(() => {
    if (component) {
      navigation.setOptions({ title: component });
    }
  }, [component, navigation]);

  return <ExplorerDetail componentName={component ?? ''} />;
}
