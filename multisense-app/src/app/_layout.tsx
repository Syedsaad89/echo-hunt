import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="games/memory" />
      <Stack.Screen name="games/echo-hunt" />
      <Stack.Screen name="games/reaction-rush" />
    </Stack>
  );
}