import { Text } from 'react-native';
import { useTheme } from '../theme';

interface HeadingProps {
  title: string;
  subtitle?: string;
}

export function Heading({ title, subtitle }: HeadingProps) {
  const theme = useTheme();

  return (
    <>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.bold,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.md }}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );
}
