import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function EmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View
      style={{ alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }}
    >
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.lg,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {title}
      </Text>
      {message ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSize.md,
            textAlign: 'center',
          }}
        >
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
