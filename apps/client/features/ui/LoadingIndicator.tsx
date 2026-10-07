import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

export function LoadingIndicator() {
  const theme = useTheme();

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
