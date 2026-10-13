import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme';

/** Keeps values in a single column when labels like "GST 18%" and "Valid until" sit side by side. */
const FIELD_LABEL_WIDTH = 110;

/** A label/value row for detail screens, shared by builder and supplier so values line up. */
export function Field({ label, value }: { label: string; value: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSize.md,
          minWidth: FIELD_LABEL_WIDTH,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.md, flexShrink: 1 }}>
        {value}
      </Text>
    </View>
  );
}
