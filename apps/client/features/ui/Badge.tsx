import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export type BadgeTone = 'neutral' | 'positive' | 'warning';

const TONES: Record<BadgeTone, { light: [string, string]; dark: [string, string] }> = {
  neutral: { light: ['#e7eaef', '#3b4350'], dark: ['#2a3039', '#c4cad4'] },
  positive: { light: ['#dcf2e1', '#1b6b32'], dark: ['#173823', '#7fd897'] },
  warning: { light: ['#fdecd9', '#8a4a0c'], dark: ['#3d2a14', '#f5b56e'] },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const [background, color] = TONES[tone][theme.dark ? 'dark' : 'light'];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: background,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color, fontSize: theme.fontSize.sm, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
