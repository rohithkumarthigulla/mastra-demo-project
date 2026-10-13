import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useNotifications } from '../../api';
import { useSession } from '../../features/auth';
import { useTheme } from '../../features/theme';
import { Button, Heading, Screen } from '../../features/ui';

export default function BuilderHomeScreen() {
  const { state, api } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const name = state.status === 'signedIn' ? state.account.displayName : '';
  const unread = useNotifications(api, { unreadOnly: true, limit: 1 }).data?.unreadCount ?? 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Builder' }} />
      <Heading title={`Welcome, ${name}`} subtitle="Find and rent equipment for your projects." />
      <View style={{ gap: theme.spacing.sm, maxWidth: theme.size.column }}>
        <Button title="Post a requirement" onPress={() => router.push('/requirements/new')} />
        <Button
          title={unread > 0 ? `Notifications (${unread})` : 'Notifications'}
          variant="secondary"
          onPress={() => router.push('/notifications')}
        />
        <Button
          title="Equipment assistant"
          variant="secondary"
          onPress={() => router.push('/assistant')}
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
