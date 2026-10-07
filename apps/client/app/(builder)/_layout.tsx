import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';

export default function BuilderLayout() {
  return <Stack screenOptions={useRoleLayoutOptions()} />;
}
