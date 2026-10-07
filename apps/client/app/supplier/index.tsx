import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../features/auth';
import { useTheme } from '../../features/theme';
import { Button, Heading, Screen } from '../../features/ui';

export default function SupplierHomeScreen() {
  const { state } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const name = state.status === 'signedIn' ? state.account.displayName : '';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Supplier' }} />
      <Heading title={`Welcome, ${name}`} subtitle="Manage your fleet and rental pipeline." />
      <View style={{ gap: theme.spacing.sm, maxWidth: 420 }}>
        <Button title="My listings" onPress={() => router.push('/supplier/fleet/listings')} />
        <Button
          title="Company profile"
          variant="secondary"
          onPress={() => router.push('/supplier/company')}
        />
      </View>
    </Screen>
  );
}
