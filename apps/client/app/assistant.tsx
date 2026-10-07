import { Stack } from 'expo-router';
import { AssistantChat } from '../features/assistant';
import { Heading, Screen } from '../features/ui';

export default function AssistantScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Equipment assistant' }} />
      <Heading
        title="Equipment assistant"
        subtitle="Tell me about your job and I will suggest suitable equipment."
      />
      <AssistantChat />
    </Screen>
  );
}
