import { Stack } from 'expo-router';
import { AgentChat } from '../../features/supplier-agent';
import { Heading, Screen } from '../../features/ui';

export default function SupplierAgentScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Assistant' }} />
      <Heading
        title="Supplier assistant"
        subtitle="Ask about the platform or your fleet. Changes always wait for your confirmation."
      />
      <AgentChat />
    </Screen>
  );
}
