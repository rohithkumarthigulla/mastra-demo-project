import { Stack } from 'expo-router';
import { useSession } from '../../features/auth';
import { Heading, Screen } from '../../features/ui';

export default function BuilderHomeScreen() {
  const { state } = useSession();
  const name = state.status === 'signedIn' ? state.account.displayName : '';

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Builder' }} />
      <Heading title={`Welcome, ${name}`} subtitle="Find and rent equipment for your projects." />
    </Screen>
  );
}
