import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useNotifications } from '../../api';
import { useSession } from '../auth';
import { useTheme } from '../theme';

/** Header bell with the unread count; opens the role's notifications screen. */
export function NotificationBell({ href }: { href: Href }) {
  const theme = useTheme();
  const router = useRouter();
  const { api } = useSession();
  const unread = useNotifications(api, { unreadOnly: true, limit: 1 }).data?.unreadCount ?? 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={() => router.push(href)}
      style={{
        minWidth: theme.size.touch,
        minHeight: theme.size.touch,
        paddingHorizontal: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: theme.fontSize.lg }}>🔔</Text>
      {unread > 0 ? (
        <View
          style={{
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            marginLeft: -6,
            marginTop: -10,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontSize: theme.fontSize.xs,
              fontWeight: theme.fontWeight.bold,
            }}
          >
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
