import { Stack } from 'expo-router';
import { useRoleLayoutOptions } from '../../features/auth';

/** Detail pages shared by builders and suppliers. */
export default function SharedDetailLayout() {
  return <Stack screenOptions={useRoleLayoutOptions()} />;
}
