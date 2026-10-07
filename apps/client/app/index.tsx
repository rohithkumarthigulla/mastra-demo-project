import type { HealthResponse } from '@ee/contracts';
import { StyleSheet, Text, View } from 'react-native';

const apiStatus: HealthResponse['status'] = 'ok';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EquipmentExchange</Text>
      <Text>Construction-equipment rental marketplace. Contracts wired: {apiStatus}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});
