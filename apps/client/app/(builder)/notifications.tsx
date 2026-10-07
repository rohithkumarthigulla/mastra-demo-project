import { Stack } from 'expo-router';
import { NotificationList } from '../../features/notifications';

export default function NotificationsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <NotificationList />
    </>
  );
}
