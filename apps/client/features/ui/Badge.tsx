import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export type BadgeTone = 'neutral' | 'positive' | 'warning';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const { background, text } = theme.tones[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: background,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs / 2,
      }}
    >
      <Text
        style={{
          color: text,
          fontSize: theme.fontSize.sm,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
