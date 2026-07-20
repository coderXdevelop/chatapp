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
      // Redirect to profile if user is already authenticated
      router.replace("/profile" as any);
    }
  }, [user, isInitialized, segments]);

  if (!isInitialized) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="profile" />
    </Stack>
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
