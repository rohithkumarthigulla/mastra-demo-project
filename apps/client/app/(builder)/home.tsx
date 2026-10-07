import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSession } from '../../features/auth';
import { PreviewBanner, useNotificationFeed } from '../../features/progress';
import { useTheme } from '../../features/theme';
import { Button, Heading, Screen } from '../../features/ui';

export default function BuilderHomeScreen() {
  const { state } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const name = state.status === 'signedIn' ? state.account.displayName : '';
  const unread = useNotificationFeed({ unreadOnly: true, limit: 1 }).data?.unreadCount ?? 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Builder' }} />
      <PreviewBanner />
      <Heading title={`Welcome, ${name}`} subtitle="Find and rent equipment for your projects." />
      <View style={{ gap: theme.spacing.sm, maxWidth: 420 }}>
        <Button title="Find equipment" onPress={() => router.push('/find')} />
        <Button
          title="Post a requirement"
          variant="secondary"
          onPress={() => router.push('/requirements/new')}
        />
        <Button title="My requests" variant="secondary" onPress={() => router.push('/requests')} />
        <Button
          title="My requirements"
          variant="secondary"
          onPress={() => router.push('/requirements')}
        />
        <Button title="Bookings" variant="secondary" onPress={() => router.push('/bookings')} />
        <Button
          title={unread > 0 ? `Notifications (${unread})` : 'Notifications'}
          variant="secondary"
          onPress={() => router.push('/notifications')}
        />
        <Button
          title="Equipment catalogue"
          variant="secondary"
          onPress={() => router.push('/equipment')}
        />
      </View>
    </Screen>
  );
}
