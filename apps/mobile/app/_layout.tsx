import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MobileProvider } from "../src/mobile-provider";
import { colors } from "../src/ui";

export default function RootLayout() {
  return (
    <MobileProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.canvas }
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: "Private workspace" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </MobileProvider>
  );
}
