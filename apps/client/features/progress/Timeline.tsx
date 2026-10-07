import { Text, View } from 'react-native';
import { useTheme } from '../theme';
import type { TimelineEntry } from './stages';

import { formatDateTime } from './dates';

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {entries.map((entry, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View
            style={{
              width: 8,
              height: 8,
              marginTop: 6,
              borderRadius: 4,
              backgroundColor:
                i === entries.length - 1 ? theme.colors.primary : theme.colors.border,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text }}>{entry.label}</Text>
            {entry.at ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSize.sm }}>
                {formatDateTime(entry.at)}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
