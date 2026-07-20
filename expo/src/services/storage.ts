import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('LocalStorage setItem error:', e);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('LocalStorage getItem error:', e);
      return null;
    }
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('LocalStorage removeItem error:', e);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}
