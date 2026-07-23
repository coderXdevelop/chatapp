import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

// Configure notification displaying behavior when app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
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
