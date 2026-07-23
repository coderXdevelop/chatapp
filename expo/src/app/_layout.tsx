import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuthStore } from "../store/authStore";

export default function RootLayout() {
  const { user, isInitialized, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const currentSegment = (segments[0] as string) || "";
    const inAuthGroup = currentSegment === "login";

    if (!user && !inAuthGroup) {
      // Redirect to login if user is not authenticated
      router.replace("/login" as any);
    } else if (user && inAuthGroup) {
      // Redirect to home if user is already authenticated
      router.replace("/home" as any);
    }
  }, [user, isInitialized, segments]);

  useEffect(() => {
    if (user) {
      // Dynamic import to avoid initialization issues
      import("../services/notifications").then(
        ({ registerForPushNotificationsAsync, registerPushTokenOnBackend }) => {
          registerForPushNotificationsAsync().then((token) => {
            if (token) {
              registerPushTokenOnBackend(token);
            }
          });
        }
      );
    }
  }, [user]);

  if (!isInitialized) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="home" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="chat/[id]" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
});
