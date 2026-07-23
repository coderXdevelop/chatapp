import User from '../models/User.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function sendPushNotification(recipientId: string, payload: PushNotificationPayload) {
  try {
    const user = await User.findById(recipientId);
    if (!user || !user.pushToken) {
      return; // No push token registered or user not found
    }

    const { title, body, data } = payload;

    // Call Expo Push Service API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: user.pushToken,
        sound: 'default',
        title,
        body,
        data,
      }),
    });

    const result = await response.json();
    console.log(`Push notification sent to ${user.displayName} (${recipientId}):`, result);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
