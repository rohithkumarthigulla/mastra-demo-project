import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';

export default function SupplierLayout() {
  return <Stack screenOptions={useRoleLayoutOptions()} />;
}
