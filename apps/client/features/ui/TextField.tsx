import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Control shown to the right of the input, such as a password Show/Hide button. */
  accessory?: ReactNode;
}

export function TextField({ label, error, accessory, ...inputProps }: TextFieldProps) {
  const theme = useTheme();

  const input = (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={theme.colors.textMuted}
      {...inputProps}
      style={{
        ...(accessory ? { flex: 1 } : null),
        color: theme.colors.text,
        backgroundColor: theme.colors.surface,
        borderColor: error ? theme.colors.danger : theme.colors.borderStrong,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing.sm + 4,
        paddingVertical: theme.spacing.sm + 2,
        minHeight: theme.size.touch,
        fontSize: theme.fontSize.md,
      }}
    />
  );

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.medium,
        }}
      >
        {label}
      </Text>
      {accessory ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          {input}
          {accessory}
        </View>
      ) : (
        input
      )}
      {error ? (
        <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.sm }}>{error}</Text>
      ) : null}
    </View>
  );
}
