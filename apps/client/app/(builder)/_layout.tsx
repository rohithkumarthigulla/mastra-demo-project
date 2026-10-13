import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';
import { TabBarLayout } from '../../features/navigation';
import { NotificationBell } from '../../features/notifications';

export default function BuilderLayout() {
  return (
    <TabBarLayout role="builder">
      <Stack screenOptions={useRoleLayoutOptions(<NotificationBell href="/notifications" />)} />
    </TabBarLayout>
  );
}
