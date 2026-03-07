import { Stack } from "expo-router";

export default function TodoDetailLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="[listId]" />
        </Stack>
    );
}
