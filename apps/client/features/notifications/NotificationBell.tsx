import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNotifications } from '../../api';
import { useSession } from '../auth';
import { useTheme } from '../theme';
import { bellAccessibilityLabel, unreadBadgeText } from './badge';

const ICON_SIZE = 24;
const BADGE_SIZE = 18;

/** Header bell with the unread count; opens the role's notifications screen. */
export function NotificationBell({ href }: { href: Href }) {
  const theme = useTheme();
  const router = useRouter();
  const { api } = useSession();
  const unread = useNotifications(api, { unreadOnly: true, limit: 1 }).data?.unreadCount ?? 0;
  const badge = unreadBadgeText(unread);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bellAccessibilityLabel(unread)}
      onPress={() => router.push(href)}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        {
          width: theme.size.touch,
          height: theme.size.touch,
          borderRadius: theme.size.touch / 2,
          backgroundColor: pressed ? theme.colors.background : 'transparent',
        },
      ]}
    >
      <View>
        <Ionicons
          name={badge ? 'notifications' : 'notifications-outline'}
          size={ICON_SIZE}
          color={theme.colors.text}
        />
        {badge ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.surface,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: 10,
                lineHeight: 12,
                fontWeight: theme.fontWeight.bold,
              }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -BADGE_SIZE / 2 + 2,
    left: ICON_SIZE - BADGE_SIZE / 2 - 2,
    minWidth: BADGE_SIZE + 4,
    height: BADGE_SIZE + 4,
    borderRadius: (BADGE_SIZE + 4) / 2,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
