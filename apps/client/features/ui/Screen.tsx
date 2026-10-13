import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarInset } from '../navigation/inset';
import { useTheme } from '../theme';

interface ScreenProps {
  children: ReactNode;
  /** Center a narrow column, e.g. for auth forms. */
  centered?: boolean;
}

export function Screen({ children, centered = false }: ScreenProps) {
  const theme = useTheme();
  const tabBarInset = useTabBarInset();

  return (
    <SafeAreaView
      // The tab bar already clears the bottom safe area, so its inset replaces it.
      edges={tabBarInset > 0 ? ['top', 'left', 'right'] : undefined}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing.lg },
          tabBarInset > 0 && { paddingBottom: tabBarInset + theme.spacing.lg },
          centered && styles.centered,
        ]}
        scrollIndicatorInsets={tabBarInset > 0 ? { bottom: tabBarInset } : undefined}
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
