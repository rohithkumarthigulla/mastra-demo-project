import { agentLanguageSchema, type AgentLanguage } from '@ee/contracts';
import * as SecureStore from 'expo-secure-store';

const KEY = 'ee.supplier-agent.language';

/** The language picked on this device. */
export async function loadLanguage(): Promise<AgentLanguage | null> {
  try {
    const parsed = agentLanguageSchema.safeParse(await SecureStore.getItemAsync(KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveLanguage(language: AgentLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, language);
  } catch {
    // Keychain unavailable: the choice lasts for this session only.
  }
}
