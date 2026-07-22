import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { user } = useAuthStore();

  if (user) {
    return <Redirect href={'/home' as any} />;
  }

  return <Redirect href={'/login' as any} />;
}
