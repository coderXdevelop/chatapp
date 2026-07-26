import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, Image, Text } from "react-native";
import { useAuthStore } from "../store/authStore";
import { useAppState } from "../hooks/useAppState";

export default function RootLayout() {
  const { user, isInitialized, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Handle socket connection and reconnection on app state focus transitions
  useAppState();

  // Route user when tapping notifications
  useEffect(() => {
    const isExpoGo =
      Constants.appOwnership === "expo" ||
      (Constants.executionEnvironment as string) === "store-client";

    if (isExpoGo) {
      return;
    }

    let subscription: { remove: () => void } | null = null;

    import("expo-notifications").then((Notifications) => {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.chatId) {
          setTimeout(() => {
            router.push(`/chat/${data.chatId}` as any);
          }, 500);
        }
      });
    }).catch((err) => {
      console.error("Failed to dynamically import expo-notifications:", err);
    });

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

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
      // expo-notifications does not support push notifications inside Expo Go on SDK 53+
      const isExpoGo =
        Constants.appOwnership === "expo" ||
        (Constants.executionEnvironment as string) === "store-client";

      if (isExpoGo) {
        console.warn("Skipping push notification registration: remote notifications are not supported in Expo Go on SDK 53+.");
        return;
      }

      // Dynamic import to avoid initialization issues
      import("../services/notifications").then(
        ({ registerForPushNotificationsAsync, registerPushTokenOnBackend }) => {
          if (registerForPushNotificationsAsync) {
            registerForPushNotificationsAsync().then((token) => {
              if (token) {
                registerPushTokenOnBackend(token);
              }
            });
          }
        }
      ).catch((err) => {
        console.error("Failed to load notifications service:", err);
      });
    }
  }, [user]);

  useEffect(() => {
    import("../services/storageManager").then(({ initStorageDirectories, runAutoCleanup }) => {
      initStorageDirectories().then(() => {
        runAutoCleanup().catch((err) => console.error("Auto cleanup background error:", err));
      });
    }).catch((err) => console.error("Failed to load storageManager:", err));
  }, []);

  if (!isInitialized) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../../assets/images/Linkup.png")}
          style={styles.splashLogo}
          resizeMode="contain"
        />
        <Text style={styles.splashTitle}>LinkUP</Text>
        <Text style={styles.splashSubtitle}>Connecting People Real-Time</Text>
        <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 24 }} />
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
        <Stack.Screen name="storage-settings" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="chat/group/create" />
        <Stack.Screen name="chat/group/settings" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: "#070b13",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(204, 255, 0, 0.25)",
  },
  splashTitle: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  splashSubtitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
});
