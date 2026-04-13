import { useRouter } from 'expo-router';

import { Box, Pressable, Text } from '@gamezilla/shared/ui';

import { ScreenHeader } from '@/ui/screen-header';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Modal" fallbackHref="/todos" />
      <Box
        sx={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          p: 5,
        }}
      >
        <Text variant="body">This is a modal screen.</Text>
        <Pressable
          onPress={() => router.dismissTo('/todos')}
          sx={{ mt: 3.75, py: 3.75 }}
        >
          <Text variant="link">Back to Todos</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
