import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../features/auth';
import { useTheme } from '../../features/theme';
import { Button, Heading, Screen } from '../../features/ui';

export default function BuilderHomeScreen() {
  const { state } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const name = state.status === 'signedIn' ? state.account.displayName : '';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Builder' }} />
      <Heading title={`Welcome, ${name}`} subtitle="Find and rent equipment for your projects." />
      <View style={{ gap: theme.spacing.sm, maxWidth: 420 }}>
        <Button title="Find equipment" onPress={() => router.push('/find')} />
        <Button
          title="Equipment catalogue"
          variant="secondary"
          onPress={() => router.push('/equipment')}
        />
      </View>
    </Screen>
  );
}
