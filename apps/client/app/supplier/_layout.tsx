import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';
import { TabBarLayout } from '../../features/navigation';
import { NotificationBell } from '../../features/notifications';

export default function SupplierLayout() {
  return (
    <TabBarLayout role="supplier">
      <Stack
        screenOptions={useRoleLayoutOptions(<NotificationBell href="/supplier/notifications" />)}
      />
    </TabBarLayout>
  );
}
