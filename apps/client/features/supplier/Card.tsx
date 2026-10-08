import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';

/** A bordered surface; pressable when `onPress` is given. */
export function Card({
  children,
  onPress,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
}) {
  const theme = useTheme();
  const style = {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  };
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.colors.text,
        fontSize: theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold,
      }}
    >
      {children}
    </Text>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.text,
        fontSize: theme.fontSize.md,
        fontWeight: theme.fontWeight.semibold,
      }}
    >
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>{children}</Text>
  );
}

/** A label/value row for detail screens. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' }}>
      <Text style={{ color: theme.colors.textMuted, minWidth: 110 }}>{label}</Text>
      <Text style={{ color: theme.colors.text, flexShrink: 1 }}>{value}</Text>
    </View>
  );
}
