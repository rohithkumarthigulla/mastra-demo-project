import { Text } from 'react-native';
import { useTheme } from '../theme';

export function ErrorMessage({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;

  return (
    <Text
      accessibilityRole="alert"
      style={{ color: theme.colors.danger, fontSize: theme.fontSize.md }}
    >
      {message}
    </Text>
  );
}
