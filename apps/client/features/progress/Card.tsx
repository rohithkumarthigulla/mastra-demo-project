import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  title: string;
  subtitle?: string;
  /** Status badge or amount shown at the top right. */
  aside?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
}

/** List row shared by requests, bookings and requirements, for either role. */
export function Card({ title, subtitle, aside, children, onPress }: CardProps) {
  const theme = useTheme();
  const body = (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{ color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {aside}
      </View>
      {children}
    </View>
  );
  const frame = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  } as const;

  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ ...frame, opacity: pressed ? 0.85 : 1 })}
    >
      {body}
    </Pressable>
  );
}

/** Label/value pair for detail screens. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md, minWidth: 110 }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md, flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}
