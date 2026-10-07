import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import { usePreviewing } from './mockFallback';

/** Shown once any screen has fallen back to sample data because an endpoint answered 501. */
export function PreviewBanner() {
  const theme = useTheme();
  if (!usePreviewing()) return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        borderColor: theme.colors.primary,
        borderWidth: 1,
        borderRadius: theme.radius.sm,
        padding: theme.spacing.sm,
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.sm }}>
        Preview: this part of the marketplace isn’t live yet, so you’re seeing sample data. Changes
        you make here aren’t saved.
      </Text>
    </View>
  );
}
