import { Stack } from 'expo-router';
import { useSession } from '../../features/auth';
import { Heading, Screen } from '../../features/ui';

export default function SupplierHomeScreen() {
  const { state } = useSession();
  const name = state.status === 'signedIn' ? state.account.displayName : '';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Supplier' }} />
      <Heading title={`Welcome, ${name}`} subtitle="Manage your fleet and rental pipeline." />
    </Screen>
  );
}
