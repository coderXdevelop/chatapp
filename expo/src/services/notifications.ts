import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  (Constants.executionEnvironment as string) === 'store-client';

let notificationHandlerSet = false;

async function getNotificationsModule() {
  if (isExpoGo) {
    return null;
  }
  try {
    const Notifications = await import('expo-notifications');
    if (!notificationHandlerSet) {
      notificationHandlerSet = true;
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
    return Notifications;
  } catch (err) {
    console.warn('expo-notifications module could not be loaded:', err);
    return null;
  }
}

export async function registerForPushNotificationsAsync() {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  let token = '';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#CCFF00',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notifications!');
      return null;
    }

    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token generated:', token);
    } catch (e) {
      console.error('Error getting expo push token:', e);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  return token;
}

export async function registerPushTokenOnBackend(pushToken: string) {
  try {
    const res = await api.patch('/api/auth/push-token', { pushToken });
    console.log('Push token successfully registered on backend:', res.data);
    return true;
  } catch (error) {
    console.error('Failed to register push token on backend:', error);
    return false;
  }
}

export async function presentLocalNotification(title: string, body: string, data?: Record<string, any>) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
      },
      trigger: null, // trigger immediately
    });
  } catch (error) {
    console.error('Error presenting local notification:', error);
  }
}

export async function addCallNotificationListener(onIncomingCallNotification: (data: any) => void) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data && data.type === 'INCOMING_CALL') {
      console.log('[PushNotification] User tapped incoming call notification:', data);
      onIncomingCallNotification(data);
    }
  });

  return () => {
    subscription.remove();
  };
}


