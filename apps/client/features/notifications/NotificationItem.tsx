import type { NotificationDto, NotificationTone } from '@ee/contracts';
import { Pressable, Text, View } from 'react-native';
import { formatDateTime } from '../progress/dates';
import { useTheme, type Theme } from '../theme';

function toneColor(theme: Theme, tone: NotificationTone): string {
  if (tone === 'good') return theme.tones.positive.text;
  if (tone === 'waiting') return theme.colors.primary;
  return theme.colors.borderStrong;
}

/** One feed row. Role-neutral: tapping it is left to the screen (mark read, follow href). */
export function NotificationItem({
  notification,
  onPress,
}: {
  notification: NotificationDto;
  onPress: () => void;
}) {
  const theme = useTheme();
  const unread = notification.readAt === null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread: ' : ''}${notification.title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 4,
          borderRadius: 2,
          backgroundColor: toneColor(theme, notification.tone),
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
            fontWeight: unread ? theme.fontWeight.bold : theme.fontWeight.regular,
          }}
        >
          {notification.title}
        </Text>
        {notification.detail ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
            {notification.detail}
          </Text>
        ) : null}
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
          {formatDateTime(notification.createdAt)}
        </Text>
      </View>
      {unread ? (
        <View
          accessibilityElementsHidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginTop: 6,
            backgroundColor: theme.colors.primary,
          }}
        />
      ) : null}
    </Pressable>
  );
}
