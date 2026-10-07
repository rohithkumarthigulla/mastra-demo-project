import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

interface ScreenProps {
  children: ReactNode;
  /** Center a narrow column, e.g. for auth forms. */
  centered?: boolean;
}

export function Screen({ children, centered = false }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing.lg },
          centered && styles.centered,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[{ gap: theme.spacing.md }, centered && styles.column]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  column: { width: '100%', maxWidth: 420 },
});
