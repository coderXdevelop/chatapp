import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

export function useAppState() {
  const appState = useRef(AppState.currentState);
  const { connectSocket, disconnectSocket } = useChatStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // Only set up app state listeners if user is authenticated
    if (!user) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App came to foreground, connecting socket...');
        connectSocket();
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('App went to background, disconnecting socket...');
        disconnectSocket();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [user, connectSocket, disconnectSocket]);
}
