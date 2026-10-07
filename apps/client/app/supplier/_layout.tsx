import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';
import { NotificationBell } from '../../features/notifications';

export default function SupplierLayout() {
  return (
    <Stack
      screenOptions={useRoleLayoutOptions(<NotificationBell href="/supplier/notifications" />)}
    />
  );
}
